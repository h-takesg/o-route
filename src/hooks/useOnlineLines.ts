import { useEffect, useRef, useState } from "react";
import {
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
import { decryptNumbers, encryptNumbers, linePurpose } from "../crypto/roomCrypto";
import { firebaseApp } from "../firebase";
import { ChunkAssembler } from "../models/ChunkAssembler";
import { DrawLine, Lines } from "../models/LineModel";
import { Point } from "../math";
import { useDatabaseRef } from "./useDatabaseRef";

function useOnlineLines(roomId: string, roomKey: CryptoKey) {
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const ownLineKeysRef = useRef<Set<string>>(new Set());
  const suppressedLineKeysRef = useRef<Set<string>>(new Set());
  const nextChunkIndexRef = useRef<Map<string, number>>(new Map());
  const lineWriteQueueRef = useRef<Map<string, Promise<void>>>(new Map());
  const [lines, setLines] = useState(new Lines());
  const linesStateRef = useRef(lines);

  const commitLines = (updater: (oldLines: Lines) => Lines) => {
    setLines((oldLines) => {
      const next = updater(oldLines);
      linesStateRef.current = next;
      return next;
    });
  };

  const enqueueLineWrite = (key: string, step: () => Promise<void>) => {
    const previous = lineWriteQueueRef.current.get(key) ?? Promise.resolve();
    const next = previous
      .then(async () => {
        if (suppressedLineKeysRef.current.has(key)) return;
        await step();
      })
      .catch((error) => {
        console.error("firebase line write failed", error);
      });
    lineWriteQueueRef.current.set(key, next);
    void next.finally(() => {
      if (lineWriteQueueRef.current.get(key) === next) {
        lineWriteQueueRef.current.delete(key);
      }
    });
  };

  const suppressAndRemoveFromDb = (key: string) => {
    suppressedLineKeysRef.current.add(key);
    ownLineKeysRef.current.delete(key);
    nextChunkIndexRef.current.delete(key);
    lineWriteQueueRef.current.delete(key);
    remove(child(linesRef, key));
  };

  const pruneOrphanOwnLines = () => {
    const orphans = [...ownLineKeysRef.current].filter(
      (key) => !linesStateRef.current.lines.has(key),
    );
    orphans.forEach((key) => suppressAndRemoveFromDb(key));
  };

  useEffect(() => {
    let cancelled = false;
    const assemblers = new Map<string, ChunkAssembler>();
    const lineChildUnsubs = new Map<string, (() => void)[]>();

    const offerChunk = async (lineKey: string, index: number, envelope: unknown) => {
      let values: number[] = [];
      if (typeof envelope === "string" && Number.isInteger(index)) {
        try {
          values = await decryptNumbers(roomKey, envelope, roomId, linePurpose(lineKey, index));
          if (values.length % 2 !== 0) {
            values = [];
          }
        } catch (error) {
          console.error("line chunk decrypt failed", error);
          values = [];
        }
      }

      if (cancelled) return;
      const assembler = assemblers.get(lineKey);
      if (assembler === undefined) return;
      const ready = assembler.offer(index, values);
      if (ready.length > 0) {
        commitLines((oldLines) => oldLines.appendValues(lineKey, ready));
      }
    };

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
        const lineKey = snapshot.key;
        const val = snapshot.val() as { isDrawing?: boolean; timestamp?: number };
        commitLines((oldLines) =>
          oldLines.addLineWithKey(
            lineKey,
            new DrawLine({
              isDrawing: val.isDrawing === true,
              timestamp: typeof val.timestamp === "number" ? val.timestamp : Date.now(),
            }),
          ),
        );

        assemblers.set(lineKey, new ChunkAssembler());

        snapshot.child("chunks").forEach((chunkSnapshot) => {
          void offerChunk(lineKey, Number(chunkSnapshot.key), chunkSnapshot.val());
        });

        if (val.isDrawing === true) {
          const chunksRef = child(linesRef, `${lineKey}/chunks`);
          const isDrawingRef = child(linesRef, `${lineKey}/isDrawing`);
          const chunksUnsub = onChildAdded(chunksRef, (chunkSnapshot) => {
            void offerChunk(lineKey, Number(chunkSnapshot.key), chunkSnapshot.val());
          });
          const isDrawingUnsub = onValue(isDrawingRef, (isDrawingSnapshot) => {
            if (!isDrawingSnapshot.val()) {
              lineChildUnsubs.get(lineKey)?.forEach((unsub) => unsub());
              lineChildUnsubs.delete(lineKey);
            }
          });
          lineChildUnsubs.set(lineKey, [chunksUnsub, isDrawingUnsub]);
        }
      }
    });

    const unsubscribeLinesRemoved = onChildRemoved(linesRef, (snapshot) => {
      if (snapshot.key === null) return;

      assemblers.delete(snapshot.key);
      lineChildUnsubs.get(snapshot.key)?.forEach((unsub) => unsub());
      lineChildUnsubs.delete(snapshot.key);

      commitLines((oldLines) => oldLines.removeLine(snapshot.key!));
    });

    return () => {
      cancelled = true;
      unsubscribeLinesAdded();
      unsubscribeLinesRemoved();
      lineChildUnsubs.forEach((subs) => subs.forEach((unsub) => unsub()));
      lineChildUnsubs.clear();
      assemblers.clear();
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
      drawingLineRef.current = push(linesRef);

      if (drawingLineRef.current.key === null) {
        console.error("new line key is null");
        return;
      }

      const newKey = drawingLineRef.current.key;
      const lineRef = drawingLineRef.current;
      ownLineKeysRef.current.add(newKey);
      nextChunkIndexRef.current.set(newKey, 1);

      commitLines((oldLines) =>
        oldLines.addLineWithKey(newKey, new DrawLine({ isDrawing: true }).addPoint(point)),
      );

      enqueueLineWrite(newKey, async () => {
        const env = await encryptNumbers(
          roomKey,
          [point.x, point.y],
          roomId,
          linePurpose(newKey, 0),
        );
        if (suppressedLineKeysRef.current.has(newKey)) return;
        await set(lineRef, {
          isDrawing: true,
          timestamp: serverTimestamp(),
          chunks: { 0: env },
        });
      });
    } else {
      const key = currentKey;
      const drawingRef = currentDrawingRef;
      const index = nextChunkIndexRef.current.get(key);
      if (typeof index === "undefined") return;

      nextChunkIndexRef.current.set(key, index + 1);
      commitLines((oldLines) => oldLines.addPoint(key, point));

      const chunkIndex = index;
      enqueueLineWrite(key, async () => {
        const env = await encryptNumbers(
          roomKey,
          [point.x, point.y],
          roomId,
          linePurpose(key, chunkIndex),
        );
        if (suppressedLineKeysRef.current.has(key)) return;
        update(child(drawingRef, "chunks"), { [chunkIndex]: env }).catch((error) => {
          console.error("firebase line write failed", error);
        });
      });
    }
  };

  const endDrawing = () => {
    const ref = drawingLineRef.current;
    if (ref === null || ref.key === null) return;

    const key = ref.key;
    drawingLineRef.current = null;
    nextChunkIndexRef.current.delete(key);

    if (!suppressedLineKeysRef.current.has(key) && linesStateRef.current.lines.has(key)) {
      enqueueLineWrite(key, async () => {
        update(ref, { isDrawing: false }).catch((error) => {
          console.error("firebase line write failed", error);
        });
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
    nextChunkIndexRef.current.clear();
    lineWriteQueueRef.current.clear();
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
