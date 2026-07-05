import { useCallback, useEffect, useRef, useState } from "react";
import { get, onValue, set } from "firebase/database";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { navigate } from "vike/client/router";
import { firebaseApp } from "../firebase";
import { useDatabaseRef } from "./useDatabaseRef";

const UPLOAD_ERROR_MESSAGE =
  "アップロードに失敗しました．ネットワーク不調もしくはファイルが大きすぎるかもしれません．20MB未満のファイルを使用してください．";

function useOnlineRoomImage(roomId: string) {
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await get(imageUrlRef);
      } catch (e) {
        // Permission denied
        navigate("/errors/room_not_found");
      }
    })();
    return onValue(imageUrlRef, (snapshot) => {
      if (snapshot.exists()) setImageUrl(snapshot.val());
    });
  }, [imageUrlRef]);

  const setImage = async (image: File) => {
    const newRef = ref(storageRoomRef.current, Date.now().toString());
    const result = await uploadBytes(newRef, image, {
      cacheControl: "private, max-age=86400",
    }).catch(() => {
      setUploadError(UPLOAD_ERROR_MESSAGE);
      return undefined;
    });

    if (typeof result === "undefined") return;

    const newUrl = await getDownloadURL(newRef);
    set(imageUrlRef, newUrl);
  };

  return { imageUrl, setImage, uploadError, clearUploadError };
}

export { useOnlineRoomImage };
