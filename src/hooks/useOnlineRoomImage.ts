import { useCallback, useEffect, useRef, useState } from "react";
import { get, onValue, set } from "firebase/database";
import { getBytes, getStorage, ref, uploadBytes } from "firebase/storage";
import { navigate } from "vike/client/router";
import { firebaseApp } from "../firebase";
import {
  ENCRYPTION_OVERHEAD_BYTES,
  IMAGE_META_PURPOSE,
  decryptBinary,
  decryptJson,
  encryptBinary,
  encryptJson,
  imageBlobPurpose,
  verifyRoomKeyCheck,
} from "../crypto/roomCrypto";
import { useDatabaseRef } from "./useDatabaseRef";

const UPLOAD_ERROR_MESSAGE =
  "アップロードに失敗しました．ネットワーク不調もしくはファイルが大きすぎるかもしれません．20MB未満のファイルを使用してください．";

const MAX_CIPHERTEXT_BYTES = 20 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = MAX_CIPHERTEXT_BYTES - ENCRYPTION_OVERHEAD_BYTES;

type ImageMeta = {
  path: string;
  type: string;
};

function isImageMeta(value: unknown): value is ImageMeta {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === "string" && typeof record.type === "string";
}

function useOnlineRoomImage(roomId: string, roomKey: CryptoKey) {
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const e2eeCheckRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/e2ee/check`);
  const roomIdRef = useRef(roomId);
  const roomKeyRef = useRef(roomKey);
  roomIdRef.current = roomId;
  roomKeyRef.current = roomKey;

  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl = "";
    let requestId = 0;

    const unsubscribe = onValue(imageUrlRef, (snapshot) => {
      const value = snapshot.val();
      if (typeof value !== "string" || value.length === 0) {
        return;
      }

      const myRequestId = ++requestId;

      void (async () => {
        try {
          const meta = await decryptJson<ImageMeta>(
            roomKeyRef.current,
            value,
            roomIdRef.current,
            IMAGE_META_PURPOSE,
          );
          if (!isImageMeta(meta) || !meta.path.startsWith(`${roomIdRef.current}/`)) {
            throw new Error("Invalid encrypted image metadata");
          }

          const storageRef = ref(getStorage(firebaseApp), meta.path);
          const ciphertextBuffer = await getBytes(storageRef, MAX_CIPHERTEXT_BYTES);
          const ciphertext = new Uint8Array(ciphertextBuffer);
          const bytes = await decryptBinary(
            roomKeyRef.current,
            ciphertext,
            roomIdRef.current,
            imageBlobPurpose(meta.path),
          );

          if (cancelled || myRequestId !== requestId) {
            return;
          }

          const newUrl = URL.createObjectURL(new Blob([bytes], { type: meta.type }));

          if (cancelled || myRequestId !== requestId) {
            URL.revokeObjectURL(newUrl);
            return;
          }

          if (currentObjectUrl.length > 0) {
            URL.revokeObjectURL(currentObjectUrl);
          }
          currentObjectUrl = newUrl;
          setImageUrl(newUrl);
        } catch (error) {
          console.error(error);
        }
      })();
    });

    void (async () => {
      try {
        await get(imageUrlRef);
      } catch {
        if (!cancelled) navigate("/errors/room_not_found");
        return;
      }

      if (cancelled) return;

      const checkSnapshot = await get(e2eeCheckRef);
      if (cancelled) return;

      const verified = await verifyRoomKeyCheck(
        roomKeyRef.current,
        roomIdRef.current,
        checkSnapshot.val(),
      );
      if (!verified && !cancelled) {
        navigate("/errors/invalid_room_key");
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      if (currentObjectUrl.length > 0) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [imageUrlRef, e2eeCheckRef]);

  const setImage = async (image: File) => {
    if (image.size >= MAX_PLAINTEXT_BYTES) {
      setUploadError(UPLOAD_ERROR_MESSAGE);
      return;
    }

    const path = `${roomId}/${Date.now()}`;

    try {
      const plaintext = new Uint8Array(await image.arrayBuffer());
      const ciphertext = await encryptBinary(roomKey, plaintext, roomId, imageBlobPurpose(path));

      const storageRef = ref(getStorage(firebaseApp), path);
      const result = await uploadBytes(storageRef, ciphertext, {
        contentType: "application/octet-stream",
        cacheControl: "private, max-age=86400",
      }).catch(() => {
        setUploadError(UPLOAD_ERROR_MESSAGE);
        return undefined;
      });

      if (typeof result === "undefined") return;

      const meta = await encryptJson(
        roomKey,
        { path, type: image.type },
        roomId,
        IMAGE_META_PURPOSE,
      );
      await set(imageUrlRef, meta);
    } catch {
      setUploadError(UPLOAD_ERROR_MESSAGE);
    }
  };

  return { imageUrl, setImage, uploadError, clearUploadError };
}

export { useOnlineRoomImage };
