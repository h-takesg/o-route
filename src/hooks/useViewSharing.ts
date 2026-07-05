import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import { child, off, onValue, set } from "firebase/database";
import { firebaseApp } from "../firebase";
import { Vector } from "../math";
import { ViewModel } from "../models/ViewModel";
import { ViewMode } from "../types";
import { useDatabaseRef } from "./useDatabaseRef";

const VIEW_SYNC_FPS = 30;

function useViewSharing(
  roomId: string,
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
    return Math.min(width / viewWidth, height / viewHeight);
  };

  const generateView = () => ({
    id: myViewLeaderId.current,
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

  useEffect(() => {
    switch (viewMode) {
      case "single":
        if (viewSyncTimer.current !== null) clearInterval(viewSyncTimer.current);
        off(viewRef);
        off(child(viewRef, "id"));
        myViewLeaderId.current = "";
        break;

      case "follwer":
        if (viewSyncTimer.current !== null) clearInterval(viewSyncTimer.current);
        off(child(viewRef, "id"));
        myViewLeaderId.current = "";

        onValue(viewRef, (snapshot) => {
          const newRotation: number = snapshot.child("rotation").val();
          const newScale = calcScale(
            snapshot.child("area").child("width").val(),
            snapshot.child("area").child("height").val(),
          );
          const newCenterOnGroupRotated = new Vector(snapshot.child("center").val()).getRotated(
            newRotation,
          );
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
        });
        break;

      case "leader":
        off(viewRef);

        myViewLeaderId.current = crypto.randomUUID();
        set(viewRef, generateView());
        onValue(child(viewRef, "id"), (snapshot) => {
          console.log(snapshot.val());
          if (snapshot.val() !== myViewLeaderId.current) {
            setViewMode("follwer");
          }
        });
        viewSyncTimer.current = window.setInterval(() => {
          if (isViewUpdated.current) {
            set(viewRef, generateView());
            isViewUpdated.current = false;
          }
        }, 1000 / VIEW_SYNC_FPS);
        break;
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "leader") {
      isViewUpdated.current = true;
    }
  }, [viewModel]);
}

export { useViewSharing };
