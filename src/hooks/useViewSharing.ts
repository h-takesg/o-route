import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import { child, onValue, set, update } from "firebase/database";
import { decryptJson, encryptJson, viewPurpose } from "../crypto/roomCrypto";
import { firebaseApp } from "../firebase";
import { Vector } from "../math";
import { ViewModel } from "../models/ViewModel";
import { ViewMode } from "../types";
import { useDatabaseRef } from "./useDatabaseRef";

const VIEW_SYNC_FPS = 30;

type ViewPayload = {
  center: { x: number; y: number };
  area: { width: number; height: number };
  rotation: number;
};

function isValidViewPayload(payload: unknown): payload is ViewPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const rotation = record.rotation;
  if (typeof rotation !== "number" || !Number.isFinite(rotation)) {
    return false;
  }
  const center = record.center;
  if (typeof center !== "object" || center === null) {
    return false;
  }
  const centerRecord = center as Record<string, unknown>;
  const cx = centerRecord.x;
  const cy = centerRecord.y;
  if (typeof cx !== "number" || !Number.isFinite(cx)) {
    return false;
  }
  if (typeof cy !== "number" || !Number.isFinite(cy)) {
    return false;
  }
  const area = record.area;
  if (typeof area !== "object" || area === null) {
    return false;
  }
  const areaRecord = area as Record<string, unknown>;
  const width = areaRecord.width;
  const height = areaRecord.height;
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
    return false;
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height <= 0) {
    return false;
  }
  return true;
}

function useViewSharing(
  roomId: string,
  roomKey: CryptoKey,
  viewMode: ViewMode,
  setViewMode: Dispatch<SetStateAction<ViewMode>>,
  viewModel: ViewModel,
  setViewModel: Dispatch<SetStateAction<ViewModel>>,
  width: number,
  height: number,
) {
  const viewRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/view`);
  const myViewLeaderId = useRef<string>("");
  const viewSyncTimer = useRef<number | null>(null);
  const isViewUpdated = useRef(false);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const viewModelRef = useRef(viewModel);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  useEffect(() => {
    viewModelRef.current = viewModel;
  }, [viewModel]);

  const calcScale = (viewWidth: number, viewHeight: number) => {
    return Math.min(widthRef.current / viewWidth, heightRef.current / viewHeight);
  };

  const generateViewPayload = (): ViewPayload => ({
    center: viewModelRef.current.position
      .getReverse()
      .getAdd(new Vector({ x: widthRef.current, y: heightRef.current }).getScaled(1 / 2))
      .getScaled(1 / viewModelRef.current.scale)
      .getRotated(-viewModelRef.current.rotation),
    area: {
      height: heightRef.current / viewModelRef.current.scale,
      width: widthRef.current / viewModelRef.current.scale,
    },
    rotation: viewModelRef.current.rotation,
  });

  const applyViewPayload = (payload: ViewPayload) => {
    const newRotation = payload.rotation;
    const newScale = calcScale(payload.area.width, payload.area.height);
    const newCenterOnGroupRotated = new Vector(payload.center).getRotated(newRotation);
    const centerOnStage = new Vector({
      x: widthRef.current,
      y: heightRef.current,
    }).getScaled(1 / 2);
    const newPosition = centerOnStage.getAdd(
      newCenterOnGroupRotated.getScaled(newScale).getReverse(),
    );

    const newViewModel = new ViewModel()
      .setPosition(newPosition)
      .setScale(newScale)
      .setRotation(newRotation);
    setViewModel(newViewModel);
  };

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let cancelled = false;

    switch (viewMode) {
      case "single":
        myViewLeaderId.current = "";
        break;

      case "follwer": {
        myViewLeaderId.current = "";
        let seq = 0;

        unsubscribes.push(
          onValue(viewRef, (snapshot) => {
            seq += 1;
            const mySeq = seq;
            const leaderId = snapshot.child("id").val();
            const payloadEnvelope = snapshot.child("payload").val();
            if (typeof leaderId !== "string" || typeof payloadEnvelope !== "string") {
              return;
            }

            void (async () => {
              let payload: unknown;
              try {
                payload = await decryptJson<ViewPayload>(
                  roomKey,
                  payloadEnvelope,
                  roomId,
                  viewPurpose(leaderId),
                );
              } catch {
                return;
              }
              if (!isValidViewPayload(payload)) {
                return;
              }
              if (cancelled || mySeq !== seq) {
                return;
              }
              applyViewPayload(payload);
            })();
          }),
        );
        break;
      }

      case "leader": {
        myViewLeaderId.current = crypto.randomUUID();
        let leaderIdConfirmed = false;
        let remoteLeaderId: unknown = null;
        set(viewRef, { id: myViewLeaderId.current }).catch((error: unknown) => {
          console.error("Failed to claim view leadership", error);
        });
        unsubscribes.push(
          onValue(child(viewRef, "id"), (snapshot) => {
            const remoteId = snapshot.val();
            remoteLeaderId = remoteId;
            if (remoteId === myViewLeaderId.current) {
              leaderIdConfirmed = true;
              return;
            }
            if (typeof remoteId === "string" && leaderIdConfirmed) {
              myViewLeaderId.current = "";
              setViewMode("follwer");
            }
          }),
        );
        // Only the claim writes `id`; ticks write `payload` alone so an in-flight tick from a
        // demoted leader cannot steal leadership back. If such a stale payload lands after ours,
        // republish so followers are not left with an undecryptable payload.
        let lastPublishedPayload: string | null = null;
        unsubscribes.push(
          onValue(child(viewRef, "payload"), (snapshot) => {
            if (snapshot.val() !== lastPublishedPayload) {
              isViewUpdated.current = true;
            }
          }),
        );
        isViewUpdated.current = true;
        let inFlight = false;
        viewSyncTimer.current = window.setInterval(() => {
          if (!isViewUpdated.current || inFlight) {
            return;
          }
          isViewUpdated.current = false;
          inFlight = true;
          void (async () => {
            try {
              const id = myViewLeaderId.current;
              const payload = await encryptJson(
                roomKey,
                generateViewPayload(),
                roomId,
                viewPurpose(id),
              );
              if (cancelled || myViewLeaderId.current !== id || remoteLeaderId !== id) {
                return;
              }
              lastPublishedPayload = payload;
              update(viewRef, { payload }).catch((error: unknown) => {
                console.error("Failed to sync encrypted view", error);
              });
            } finally {
              inFlight = false;
            }
          })();
        }, 1000 / VIEW_SYNC_FPS);
        break;
      }
    }

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsub) => unsub());
      if (viewSyncTimer.current !== null) {
        clearInterval(viewSyncTimer.current);
        viewSyncTimer.current = null;
      }
    };
  }, [viewMode, viewRef, setViewModel, setViewMode]);

  useEffect(() => {
    if (viewMode === "leader") {
      isViewUpdated.current = true;
    }
  }, [viewModel, viewMode]);
}

export { useViewSharing };
