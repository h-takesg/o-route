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
import { firebaseApp } from "../firebase";
import { DrawLine, Lines } from "../models/LineModel";
import { Point } from "../math";
import { useDatabaseRef } from "./useDatabaseRef";

function useOnlineLines(roomId: string) {
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const [lines, setLines] = useState(new Lines());

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
          return oldLines.updateTimestamp(snapshot.key, snapshot.child("timestamp").val());
        });
      } else {
        // 他人の線
        setLines((oldLines) => {
          if (snapshot.key === null) {
            // コールバックにつきここでも判定が必要
            console.error("incoming new line key is null");
            return oldLines;
          }
          return oldLines.addLineWithKey(snapshot.key, DrawLine.of(snapshot.val()));
        });

        // 自分以外の線でかつ描き込み中なら以降の更新をlistenする
        if (snapshot.val().isDrawing) {
          onChildAdded(child(linesRef, `${snapshot.key}/points`), addNewPointFactory(snapshot.key));
          onValue(child(linesRef, `${snapshot.key}/isDrawing`), (snapshotIsDrawing) => {
            if (!snapshotIsDrawing.val()) {
              off(child(linesRef, `${snapshot.key}/isDrawing`));
              off(child(linesRef, `${snapshot.key}/points`));
            }
          });
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

  return {
    lines,
    addPointToDrawingLine,
    endDrawing,
    removeLines,
    clearAllLines,
  };
}

export { useOnlineLines };
