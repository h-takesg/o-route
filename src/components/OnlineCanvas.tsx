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
import { DrawLine, Lines, Mode } from "../types";
import { Point, Vector } from "../math";
import { Overlay } from "./Overlay";

type Props = {
  firebaseApp: FirebaseApp;
};

function OnlineCanvas({ firebaseApp }: Props) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("move");
  const [imageUrl, setImageUrl] = useState<string>("");
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const [groupPosition, setGroupPosition] = useState(new Vector({x: 0, y: 0}));
  const [groupScale, setGroupScale] = useState(1);
  const [groupRotation, setGroupRotation] = useState(0);
  const [lines, setLines] = useState<Lines>({});

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
          [snapshot.key]: newLine
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

  return (
    <>
      <Canvas
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
      <Overlay
        mode={mode}
        setMode={setMode}
        setImage={setImage}
        clearAllLines={clearAllLines}
      />
    </>
  );
}

export { OnlineCanvas };
