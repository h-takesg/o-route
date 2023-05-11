import { FirebaseApp } from "firebase/app";
import { Canvas } from "./Canvas";
import { useEffect, useRef, useState } from "react";
import {
  DataSnapshot,
  DatabaseReference,
  child,
  off,
  onChildAdded,
  onChildRemoved,
  onValue,
  push,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useDatabaseRef } from "../hooks/useDatabaseRef";
import { useNavigate, useParams } from "react-router-dom";
import { Mode, ViewMode } from "../types";
import { DrawLine, Lines } from "../LineModel";
import { Point, Vector } from "../math";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";
import { ViewSharingControl } from "./ViewSharingControl";
import { useWindowSize } from "../hooks/useWindwosSize";
import { ViewModel } from "../ViewModel";

type Props = {
  firebaseApp: FirebaseApp;
};

function OnlineCanvas({ firebaseApp }: Props) {
  const [width, height] = useWindowSize();
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("move");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const viewRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/view`);
  const myViewLeaderId = useRef<string>("");
  const viewSyncTimer = useRef<number | null>(null);
  const isViewUpdated = useRef(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const [viewModel, setViewModel] = useState(new ViewModel());
  const viewModelRef = useRef(viewModel);
  const [lines, setLines] = useState(new Lines());

  const VIEW_SYNC_FPS = 30;

  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  useEffect(() => {
    viewModelRef.current = viewModel;
  }, [viewModel]);

  const setImage = async (image: File) => {
    const newRef = ref(storageRoomRef.current, Date.now().toString());
    const result = await uploadBytes(newRef, image, {
      cacheControl: "private, max-age=86400",
    }).catch(() =>
      alert(
        "アップロードに失敗しました．ネットワーク不調もしくはファイルが大きすぎるかもしれません．20MB未満のファイルを使用してください．"
      )
    );

    if (typeof result === "undefined") return;

    const newUrl = await getDownloadURL(newRef);
    set(imageUrlRef, newUrl);
  };

  const addPointToDrawingLine = (point: Point) => {
    if (
      drawingLineRef.current === null ||
      drawingLineRef.current.key === null || // drawingLineRefが壊れているので新しい線に変える
      !lines.lines.keySeq().includes(drawingLineRef.current.key) // 描いてた線が消されたとき
    ) {
      const newLine = new DrawLine({ isDrawing: true }).addPoint(point);
      drawingLineRef.current = push(linesRef);

      if (drawingLineRef.current.key === null) {
        console.error("new line key is null");
        return;
      }

      // for local
      setLines(lines.addLineWithKey(drawingLineRef.current.key, newLine));

      // for upload
      const uploadLine = {
        ...newLine.toJS(),
        timestamp: serverTimestamp(),
      };
      set(drawingLineRef.current, uploadLine);
    } else {
      const oldLength = lines.getLength(drawingLineRef.current.key);
      if (typeof oldLength === "undefined") return;

      // for local
      setLines(lines.addPoint(drawingLineRef.current.key, point));

      // for upload
      update(child(drawingLineRef.current, "points"), {
        [oldLength]: point.x,
        [oldLength + 1]: point.y,
      });
    }
  };

  const endDrawing = () => {
    if (drawingLineRef.current === null) return;

    set(child(drawingLineRef.current, "isDrawing"), false);
    drawingLineRef.current = null;
  };

  const removeLines = (ids: string[]) => {
    ids.forEach((id) => remove(child(linesRef, id)));
  };

  const clearAllLines = () => {
    remove(linesRef);
  };

  useEffect(() => {
    return onValue(imageUrlRef, (snapshot) => {
      if (snapshot.exists()) setImageUrl(snapshot.val());
      else navigate("/errors/room_not_found");
    });
  }, []);

  const addNewPointFactory = (lineKey: string) => {
    return (snapshot: DataSnapshot) => {
      setLines((oldLines) => {
        return oldLines.addValue(lineKey, snapshot.val());
      });
    };
  };

  useEffect(() => {
    onChildAdded(linesRef, (snapshot) => {
      if (snapshot.key === null) return;

      if (Object.keys(lines).includes(snapshot.key)) {
        // 自分の線 タイムスタンプをサーバー由来のもので上書きする
        setLines((oldLines) => {
          if (snapshot.key === null) {
            // コールバックにつきここでも判定が必要
            console.error("incoming new line key is null");
            return oldLines;
          }
          return oldLines.updateTimestamp(
            snapshot.key,
            snapshot.child("timestamp").val()
          );
        });
      } else {
        // 他人の線
        setLines((oldLines) => {
          if (snapshot.key === null) {
            // コールバックにつきここでも判定が必要
            console.error("incoming new line key is null");
            return oldLines;
          }
          return oldLines.addLineWithKey(
            snapshot.key,
            DrawLine.of(snapshot.val())
          );
        });

        // 自分以外の線でかつ描き込み中なら以降の更新をlistenする
        if (snapshot.val().isDrawing) {
          onChildAdded(
            child(linesRef, `${snapshot.key}/points`),
            addNewPointFactory(snapshot.key)
          );
          onValue(
            child(linesRef, `${snapshot.key}/isDrawing`),
            (snapshotIsDrawing) => {
              if (!snapshotIsDrawing.val()) {
                off(child(linesRef, `${snapshot.key}/isDrawing`));
                off(child(linesRef, `${snapshot.key}/points`));
              }
            }
          );
        }
      }
    });
    onChildRemoved(linesRef, (snapshot) => {
      setLines((oldLines) => {
        if (snapshot.key === null) return oldLines;

        return oldLines.removeLine(snapshot.key);
      });
    });
    return () => off(linesRef);
  }, []);

  const calcScale = (viewWidth: number, viewHeight: number) => {
    return Math.min(width / viewWidth, height / viewHeight);
  };

  const generateView = () => ({
    id: myViewLeaderId.current,
    center: viewModelRef.current.position
      .getReverse()
      .getAdd(
        new Vector({ x: widthRef.current, y: heightRef.current }).getScaled(
          1 / 2
        )
      )
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
        if (viewSyncTimer.current !== null)
          clearInterval(viewSyncTimer.current);
        off(viewRef);
        off(child(viewRef, "id"));
        myViewLeaderId.current = "";
        break;

      case "follwer":
        if (viewSyncTimer.current !== null)
          clearInterval(viewSyncTimer.current);
        off(child(viewRef, "id"));
        myViewLeaderId.current = "";

        onValue(viewRef, (snapshot) => {
          const newRotation: number = snapshot.child("rotation").val();
          const newScale = calcScale(
            snapshot.child("area").child("width").val(),
            snapshot.child("area").child("height").val()
          );
          const newCenterOnGroupRotated = new Vector(
            snapshot.child("center").val()
          ).getRotated(newRotation);
          const centerOnStage = new Vector({
            x: widthRef.current,
            y: heightRef.current,
          }).getScaled(1 / 2);
          const newPosition = centerOnStage.getAdd(
            newCenterOnGroupRotated.getScaled(newScale).getReverse()
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

  return (
    <>
      <Canvas
        width={width}
        height={height}
        mode={mode}
        imageUrl={imageUrl}
        lines={lines}
        addPointToDrawingLine={addPointToDrawingLine}
        endDrawing={endDrawing}
        removeLines={removeLines}
        viewModel={viewModel}
        setViewModel={setViewModel}
      />
      <Overlay>
        <BasicControl
          mode={mode}
          setMode={setMode}
          setImage={setImage}
          clearAllLines={clearAllLines}
        />
        <ViewSharingControl viewMode={viewMode} setViewMode={setViewMode} />
      </Overlay>
    </>
  );
}

export { OnlineCanvas };
