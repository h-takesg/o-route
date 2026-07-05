import { useEffect, useRef, useState } from "react";
import {
  DataSnapshot,
  DatabaseReference,
  child,
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
  const ownLineKeysRef = useRef<Set<string>>(new Set());
  const suppressedLineKeysRef = useRef<Set<string>>(new Set());
  const drawingPointCountRef = useRef<Map<string, number>>(new Map());
  const initialLineWriteRef = useRef<Map<string, Promise<void>>>(new Map());
  const [lines, setLines] = useState(new Lines());
  const linesStateRef = useRef(lines);

  const commitLines = (updater: (oldLines: Lines) => Lines) => {
    setLines((oldLines) => {
      const next = updater(oldLines);
      linesStateRef.current = next;
      return next;
    });
  };

  const afterInitialLineWrite = (key: string, write: () => void | Promise<void>) => {
    const initialWrite = initialLineWriteRef.current.get(key) ?? Promise.resolve();
    void initialWrite.then(write).catch((error) => {
      console.error("firebase line write failed", error);
    });
  };

  const suppressAndRemoveFromDb = (key: string) => {
    suppressedLineKeysRef.current.add(key);
    ownLineKeysRef.current.delete(key);
    drawingPointCountRef.current.delete(key);
    initialLineWriteRef.current.delete(key);
    remove(child(linesRef, key));
  };

  const pruneOrphanOwnLines = () => {
    const orphans = [...ownLineKeysRef.current].filter(
      (key) => !linesStateRef.current.lines.has(key),
    );
    orphans.forEach((key) => suppressAndRemoveFromDb(key));
  };

  const addNewPointFactory = (lineKey: string) => {
    return (snapshot: DataSnapshot) => {
      commitLines((oldLines) => oldLines.addValue(lineKey, snapshot.val()));
    };
  };

  useEffect(() => {
    const lineChildUnsubs = new Map<string, (() => void)[]>();

    const unsubscribeLinesAdded = onChildAdded(linesRef, (snapshot) => {
      if (snapshot.key === null) return;

      if (suppressedLineKeysRef.current.has(snapshot.key)) {
        remove(child(linesRef, snapshot.key));
        return;
      }

      if (ownLineKeysRef.current.has(snapshot.key)) {
        commitLines((oldLines) => {
          if (!oldLines.lines.has(snapshot.key!)) return oldLines;
          return oldLines.updateTimestamp(snapshot.key!, snapshot.child("timestamp").val());
        });
      } else {
        commitLines((oldLines) => {
          return oldLines.addLineWithKey(snapshot.key!, DrawLine.of(snapshot.val()));
        });

        if (snapshot.val().isDrawing) {
          const lineKey = snapshot.key;
          const pointsRef = child(linesRef, `${lineKey}/points`);
          const isDrawingRef = child(linesRef, `${lineKey}/isDrawing`);
          const pointsUnsub = onChildAdded(pointsRef, addNewPointFactory(lineKey));
          const isDrawingUnsub = onValue(isDrawingRef, (snapshotIsDrawing) => {
            if (!snapshotIsDrawing.val()) {
              lineChildUnsubs.get(lineKey)?.forEach((unsub) => unsub());
              lineChildUnsubs.delete(lineKey);
            }
          });
          lineChildUnsubs.set(lineKey, [pointsUnsub, isDrawingUnsub]);
        }
      }
    });

    const unsubscribeLinesRemoved = onChildRemoved(linesRef, (snapshot) => {
      commitLines((oldLines) => {
        if (snapshot.key === null) return oldLines;

        return oldLines.removeLine(snapshot.key);
      });
    });

    return () => {
      unsubscribeLinesAdded();
      unsubscribeLinesRemoved();
      lineChildUnsubs.forEach((subs) => subs.forEach((unsub) => unsub()));
      lineChildUnsubs.clear();
    };
  }, [linesRef]);

  const addPointToDrawingLine = (point: Point) => {
    const currentDrawingRef = drawingLineRef.current;
    const currentKey = currentDrawingRef?.key ?? null;
    const shouldStartNewLine =
      currentDrawingRef === null ||
      currentKey === null ||
      suppressedLineKeysRef.current.has(currentKey);

    if (shouldStartNewLine) {
      const newLine = new DrawLine({ isDrawing: true }).addPoint(point);
      drawingLineRef.current = push(linesRef);

      if (drawingLineRef.current.key === null) {
        console.error("new line key is null");
        return;
      }

      const newKey = drawingLineRef.current.key;
      const lineRef = drawingLineRef.current;
      ownLineKeysRef.current.add(newKey);
      drawingPointCountRef.current.set(newKey, 2);

      commitLines((oldLines) => oldLines.addLineWithKey(newKey, newLine));

      const uploadLine = {
        ...newLine.toJS(),
        timestamp: serverTimestamp(),
      };
      // 初回 set だけ直列化の起点にする。後続 update は並列で送ってよい。
      const initialWrite = set(lineRef, uploadLine).catch((error) => {
        console.error("firebase line write failed", error);
      });
      initialLineWriteRef.current.set(newKey, initialWrite);
    } else {
      const key = currentKey;
      const drawingRef = currentDrawingRef;
      const pointIndex = drawingPointCountRef.current.get(key);
      if (typeof pointIndex === "undefined") return;

      drawingPointCountRef.current.set(key, pointIndex + 2);
      commitLines((oldLines) => oldLines.addPoint(key, point));

      const uploadIndex = pointIndex;
      afterInitialLineWrite(key, () =>
        update(child(drawingRef, "points"), {
          [uploadIndex]: point.x,
          [uploadIndex + 1]: point.y,
        }),
      );
    }
  };

  const endDrawing = () => {
    const ref = drawingLineRef.current;
    if (ref === null || ref.key === null) return;

    const key = ref.key;
    const initialWrite = initialLineWriteRef.current.get(key) ?? Promise.resolve();
    drawingLineRef.current = null;
    drawingPointCountRef.current.delete(key);
    initialLineWriteRef.current.delete(key);

    if (!suppressedLineKeysRef.current.has(key) && linesStateRef.current.lines.has(key)) {
      void initialWrite
        .then(() => update(ref, { isDrawing: false }))
        .catch((error) => {
          console.error("firebase line write failed", error);
        });
    }
  };

  const removeLines = (ids: string[]) => {
    if (ids.length === 0) return;

    ids.forEach((id) => {
      if (drawingLineRef.current?.key === id) {
        drawingLineRef.current = null;
      }
      suppressAndRemoveFromDb(id);
    });
    commitLines((oldLines) => oldLines.removeLine(...ids));
    pruneOrphanOwnLines();
  };

  const clearAllLines = () => {
    drawingLineRef.current = null;
    drawingPointCountRef.current.clear();
    initialLineWriteRef.current.clear();
    ownLineKeysRef.current.forEach((key) => {
      suppressedLineKeysRef.current.add(key);
    });
    ownLineKeysRef.current.clear();
    linesStateRef.current = new Lines();
    setLines(new Lines());
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
