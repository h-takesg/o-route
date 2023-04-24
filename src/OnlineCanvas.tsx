import { FirebaseApp } from "firebase/app";
import Canvas from "./Canvas";
import { useEffect, useRef, useState } from "react";
import { DataSnapshot, DatabaseReference, child, off, onChildAdded, onChildRemoved, onValue, push, remove, set, update } from "firebase/database";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useDatabaseRef } from "./hooks/useDatabaseRef";
import { useNavigate, useParams } from "react-router-dom";
import { DrawLine, Lines } from "./types";
import { Point } from "./math";

type Props = {
  firebaseApp: FirebaseApp;
}

function OnlineCanvas({firebaseApp}: Props) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState<string>('');
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const [lines, setLines] = useState<Lines>({});

  const setImage = async (image: File) => {
    const newRef = ref(storageRoomRef.current, Date.now().toString());
    await uploadBytes(newRef, image,{cacheControl: "private, max-age=86400"});
    const newUrl = await getDownloadURL(newRef);
    set(imageUrlRef, newUrl);
  }

  const addPointToDrawingLine = ({ x, y }: Point) => {
    if (drawingLineRef.current === null
        || !Object.keys(lines).includes(drawingLineRef.current.key!)
    ) {
      const newLine: DrawLine = {
        isDrawing: true,
        timestamp: Date.now().toString(),
        points: [x, y],
        compositionMode: "source-over"
      }
      drawingLineRef.current = push(linesRef);

      // for upload
      set(drawingLineRef.current, newLine);

      // for local
      setLines({
        ...lines,
        [drawingLineRef.current.key!]: newLine
      });
    } else {
      const oldLine = lines[drawingLineRef.current.key!];
      const oldLength = oldLine.points.length;
      
      // for upload
      update(child(drawingLineRef.current, "points"),{
        [oldLength]: x,
        [oldLength + 1]: y
      });
      
      // for local
      const newLine = {
        ...oldLine,
        points: [...oldLine.points, x, y]
      };
      setLines({
        ...lines,
        [drawingLineRef.current.key!]: newLine
      });
    }
  }

  const endDrawing = () => {
    set(child(drawingLineRef.current!, "isDrawing"), false);
    drawingLineRef.current = null;
  }

  const removeLines = (ids: string[]) => {
    ids.forEach(id => remove(child(linesRef!, id)));
  }
  
  const clearAllLines = () => {
    remove(linesRef);
  }

  
  useEffect(() => {
    return onValue(imageUrlRef, (snapshot) => {
      if (snapshot.exists()) setImageUrl(snapshot.val());
      else navigate("/errors/room_not_found");
    });
  }, []);

  const addNewPointFactory = (lineKey: string) => {
    return (snapshot: DataSnapshot) => {
      setLines(oldLines => {
        const targetLine = {...oldLines[lineKey]};
        targetLine.points = [...targetLine.points, snapshot.val()];
        return {
          ...oldLines,
          [lineKey]: targetLine
        }
      });
    }
  }

  useEffect(() => {
    onChildAdded(linesRef, (snapshot) => {
      setLines(oldLines => ({...oldLines, [snapshot.key!]: snapshot.val()}));

      // 自分以外の線でかつ描き込み中なら以降の更新をlistenする
      if (drawingLineRef.current?.key !== snapshot.key && snapshot.val().isDrawing) {
        onChildAdded(child(linesRef, `${snapshot.key}/points`), addNewPointFactory(snapshot.key!));
        onValue(child(linesRef, `${snapshot.key}/isDrawing`), (snapshotIsDrawing) => {
          if (!snapshotIsDrawing.val()) {
            off(child(linesRef, `${snapshot.key}/isDrawing`));
            off(child(linesRef, `${snapshot.key}/points`));
          }
        })
      }
    });
    onChildRemoved(linesRef, (snapshot) => {
      setLines(oldLines => {
        const temp = {...oldLines};
        delete temp[snapshot.key!];
        return temp;
      })
    });
    return () => off(linesRef);
  }, []);

  return (
    <Canvas
      imageUrl={imageUrl}
      setImage={setImage}
      lines={lines}
      addPointToDrawingLine={addPointToDrawingLine}
      endDrawing={endDrawing}
      removeLines={removeLines}
      clearAllLines={clearAllLines}
    />
  )
}

export { OnlineCanvas };
