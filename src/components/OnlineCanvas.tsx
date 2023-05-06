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
import { DrawLine, Lines, Mode, ViewMode } from "../types";
import { Point, Vector } from "../math";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";
import { ViewSharingControl } from "./ViewSharingControl";
import { useWindowSize } from "../hooks/useWindwosSize";

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
  const [groupPosition, setGroupPosition] = useState(
    new Vector({ x: 0, y: 0 })
  );
  const [groupScale, setGroupScale] = useState(1);
  const [groupRotation, setGroupRotation] = useState(0);
  const groupPositionRef = useRef(groupPosition);
  const groupScaleRef = useRef(groupScale);
  const groupRotationRef = useRef(groupRotation);
  const [lines, setLines] = useState<Lines>({});

  const VIEW_SYNC_FPS = 30;

  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  useEffect(() => {
    groupPositionRef.current = groupPosition;
  }, [groupPosition]);
  useEffect(() => {
    groupScaleRef.current = groupScale;
  }, [groupScale]);
  useEffect(() => {
    groupRotationRef.current = groupRotation;
  }, [groupRotation]);

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

  const addPointToDrawingLine = ({ x, y }: Point) => {
    if (
      drawingLineRef.current === null ||
      drawingLineRef.current.key === null || // drawingLineRefが壊れているので新しい線に変える
      !Object.keys(lines).includes(drawingLineRef.current.key) // 描いてた線が消されたとき
    ) {
      const newLine: DrawLine = {
        isDrawing: true,
        timestamp: Date.now().toString(),
        points: [x, y],
        compositionMode: "source-over",
      };
      drawingLineRef.current = push(linesRef);

      if (drawingLineRef.current.key === null) {
        console.error("new line key is null");
        return;
      }

      // for local
      setLines({
        ...lines,
        [drawingLineRef.current.key]: newLine,
      });

      // for upload
      const uploadLine = {
        ...newLine,
        timestamp: serverTimestamp(),
      };
      set(drawingLineRef.current, uploadLine);
    } else {
      const oldLine = lines[drawingLineRef.current.key];
      const oldLength = oldLine.points.length;

      // for local
      const newLine = {
        ...oldLine,
        points: [...oldLine.points, x, y],
      };
      setLines({
        ...lines,
        [drawingLineRef.current.key]: newLine,
      });

      // for upload
      update(child(drawingLineRef.current, "points"), {
        [oldLength]: x,
        [oldLength + 1]: y,
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
        const targetLine = { ...oldLines[lineKey] };
        targetLine.points = [...targetLine.points, snapshot.val()];
        return {
          ...oldLines,
          [lineKey]: targetLine,
        };
      });
    };
  };

  useEffect(() => {
    onChildAdded(linesRef, (snapshot) => {
      if (snapshot.key === null) return;

      setLines((oldLines) => {
        if (snapshot.key === null) {
          // コールバックにつきここでも判定が必要
          console.error("incoming new line key is null");
          return oldLines;
        }
        return { ...oldLines, [snapshot.key]: snapshot.val() };
      });

      // linesに既に存在しているならtimestampを上書きする
      if (Object.keys(lines).includes(snapshot.key)) {
        const newLine = {
          ...lines[snapshot.key],
          timestamp: snapshot.val().timestamp,
        };
        setLines({
          ...lines,
          [snapshot.key]: newLine,
        });
      }

      // 自分以外の線でかつ描き込み中なら以降の更新をlistenする
      if (
        drawingLineRef.current?.key !== snapshot.key &&
        snapshot.val().isDrawing
      ) {
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
    });
    onChildRemoved(linesRef, (snapshot) => {
      setLines((oldLines) => {
        if (snapshot.key === null) return oldLines;

        const temp = { ...oldLines };
        delete temp[snapshot.key];
        return temp;
      });
    });
    return () => off(linesRef);
  }, []);

  const calcScale = (viewWidth: number, viewHeight: number) => {
    return Math.min(width / viewWidth, height / viewHeight);
  };

  const generateView = () => ({
    id: myViewLeaderId.current,
    center: groupPositionRef.current
      .getReverse()
      .getAdd(
        new Vector({ x: widthRef.current, y: heightRef.current }).getScaled(
          1 / 2
        )
      )
      .getScaled(1 / groupScaleRef.current)
      .getRotated(-groupRotationRef.current),
    area: {
      height: heightRef.current / groupScaleRef.current,
      width: widthRef.current / groupScaleRef.current,
    },
    rotation: groupRotationRef.current,
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

          setGroupPosition(newPosition);
          setGroupScale(newScale);
          setGroupRotation(newRotation);
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
  }, [groupPosition, groupScale, groupRotation]);

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
        groupPosition={groupPosition}
        groupScale={groupScale}
        groupRotation={groupRotation}
        setGroupPosition={setGroupPosition}
        setGroupScale={setGroupScale}
        setGroupRotation={setGroupRotation}
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
