import Konva from "konva"
import { useEffect, useRef, useState } from "react"
import { Layer, Stage, Image, Group, Line, Rect } from "react-konva"
import useImage from "use-image"
import { useWindowSize } from "./hooks/useWindwosSize"
import { DrawLine, Lines, Mode } from "./types"
import { Point, intersectsLineSegment, rotateVector } from "./math"
import { DataSnapshot, DatabaseReference, child, off, onChildAdded, onChildRemoved, onValue, push, remove, set, update } from "firebase/database";
import { getStorage, ref } from "firebase/storage";
import { FirebaseApp } from "firebase/app"
import { useDatabaseRef } from "./hooks/useDatabaseRef"
import { Overlay } from "./Overlay"

const MapImage = ({url}: {url:string}) => {
  const [image] = useImage(url)
  return <Image image={image} />
}

type Props = {
  roomId: string;
  firebaseApp: FirebaseApp;
}

function Canvas({roomId, firebaseApp}: Props) {
  const [width, height] = useWindowSize();
  const [imageUrl, setImageUrl] = useState<string>('./samplemap.jpg');
  const [mode, setMode] = useState<Mode>("move");
  const [lines, setLines] = useState<Lines>({});
  const stageRef = useRef<Konva.Stage>(null)
  const groupRef = useRef<Konva.Group>(null)
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const pointermoveBeforePositionOnStage = useRef<{x:number, y: number} | null>(null);
  const beforePointersDistance = useRef<number | null>(null);
  const beforePointersRotation = useRef<number | null>(null);
  const eraseMousemoveBeforePositionOnGroup = useRef<{x:number, y: number} | null>(null);
  const dragVelocity = useRef({x: 0, y: 0});
  const dragMomentum = useRef<Konva.Tween | null>(null);
  const SCALE_BY = 1.1;
  const ROTATE_BY = 0.02;
  const SCALE_MIN = 0.1;
  const SCALE_MAX = 5;
  const BACKGROUND_SIZE = 80000;
  const BACKGROUND_OFFSET = BACKGROUND_SIZE * 2 / 5;

  // Canvasの座標で中心を指定しGroupをdegree回転させる
  const rotateAt = (x: number, y: number, degree: number) => {
    const group = groupRef.current;
    if (group === null) return;   

    const SNAPPING_DEGREE = 90;

    const originalPositiveRotatedDegree = group.rotation() + degree + 360;
    // degreeが最も近いSNAPPING_DEGREEの倍数との差を求める
    const delta = (originalPositiveRotatedDegree + SNAPPING_DEGREE / 2) % SNAPPING_DEGREE + SNAPPING_DEGREE / 2;

    // snappingDegreeごとにスナップを付ける
    const snappedDegree = (Math.abs(delta) < 1) ? degree - delta : degree;

    const oldCenterToGroup = {
      x: group.x() - x,
      y: group.y() - y
    }
    const newCenterToGroup = rotateVector(oldCenterToGroup.x, oldCenterToGroup.y, snappedDegree);

    const newPosition = {
      x: x + newCenterToGroup.x,
      y: y + newCenterToGroup.y
    } 
    group.position(newPosition);
    group.rotation((group.rotation() + snappedDegree)%360);
  }

  // Canvasの座標で中心を指定しGroupをscale倍する
  const scaleAt = (x: number, y: number, scale: number) => {
    const stage = stageRef.current;
    const group = groupRef.current;
    if (stage === null || group === null) return;

    const oldScale = group.scaleX()
    const pointerOnStage = {x, y};
    const pointerOnGroupNoRotation = {
      x: (pointerOnStage.x - group.x()) / oldScale,
      y: (pointerOnStage.y - group.y()) / oldScale
    };
    const newScale = Math.max(SCALE_MIN, Math.min(oldScale * scale, SCALE_MAX));
    group.scale({ x: newScale, y: newScale});
    const newPos = {
      x: pointerOnStage.x - pointerOnGroupNoRotation.x * newScale,
      y: pointerOnStage.y - pointerOnGroupNoRotation.y * newScale,
    }
    group.position(newPos);
  }

  const clearAllLines = () => {
    remove(linesRef!);
  }
  
  const handleMouseDown = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (mode !== "move") return;

    pointermoveBeforePositionOnStage.current = null;
    beforePointersDistance.current = null;
    beforePointersRotation.current = null;
    
    if (dragMomentum.current !== null) {
      dragMomentum.current.destroy();
      dragMomentum.current = null;
    }
  }

  const handleTouchmove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (event.evt.touches.length >= 2) {
      handleTwoPointerMove(event);
    } else {
      console.log("single");
      handleOnePointerMove(event);
    }
  }

  const handleOnePointerMove = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.evt instanceof MouseEvent && event.evt.buttons === 0) return;

    const group = groupRef.current;
    if (group === null) return;

    const pointerOnGroup = group.getRelativePointerPosition();
    
    switch(mode){
      case "move":
        const pointerX = (event.evt instanceof MouseEvent) ? 
          event.evt.pageX : event.evt.touches[0].pageX;
        const pointerY = (event.evt instanceof MouseEvent) ?
          event.evt.pageY : event.evt.touches[0].pageY;
        if (pointermoveBeforePositionOnStage.current !== null) {
          const movementX = pointerX - pointermoveBeforePositionOnStage.current.x;
          const movementY = pointerY - pointermoveBeforePositionOnStage.current.y;
  
          group.position({
            x: group.x() + movementX,
            y: group.y() + movementY
          });
          
          dragVelocity.current = {x: movementX, y: movementY};
        }

        pointermoveBeforePositionOnStage.current = {
          x: pointerX,
          y: pointerY
        };
        break;
      case "draw":
        if (typeof linesRef === "undefined") return;
    
        if (drawingLineRef.current === null) {
          const newLine: DrawLine = {
            isDrawing: true,
            timestamp: Date.now().toString(),
            points: [pointerOnGroup.x, pointerOnGroup.y],
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
            [oldLength]: pointerOnGroup.x,
            [oldLength + 1]: pointerOnGroup.y
          });
          
          // for local
          const newLine = {...oldLine};
          newLine.points = [...oldLine.points, pointerOnGroup.x, pointerOnGroup.y];
          setLines({
            ...lines,
            [drawingLineRef.current.key!]: newLine
          });
        }
        break;
      case "erase":
        if (eraseMousemoveBeforePositionOnGroup.current !== null) {
          const beforePoint: Point = [
            eraseMousemoveBeforePositionOnGroup.current.x,
            eraseMousemoveBeforePositionOnGroup.current.y
          ];
          const pointerPoint: Point = [
            pointerOnGroup.x,
            pointerOnGroup.y
          ];
          
          const toBeRemoved: string[] = [];
          
          for (const key in lines) {
            const line = lines[key];
            for (let i = 0; i < line.points.length/2 - 1; i++) {
              if (intersectsLineSegment([beforePoint, pointerPoint], [[line.points[i*2], line.points[i*2+1]], [line.points[i*2+2], line.points[i*2+3]]])) {
                toBeRemoved.push(key);
                break;
              }
            }
          }
          
          toBeRemoved.forEach(id => remove(child(linesRef!, id)));
        }
        eraseMousemoveBeforePositionOnGroup.current = pointerOnGroup;
        break;
    }
  }

  const handleTwoPointerMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (mode !== "move") return;

    const group = groupRef.current;
    if (group === null) return;

    const pointer0Position = {
      x: event.evt.touches[0].pageX,
      y: event.evt.touches[0].pageY
    };
    const pointer1Position = {
      x: event.evt.touches[1].pageX,
      y: event.evt.touches[1].pageY
    };
    const midpointPosition = {
      x: (pointer0Position.x + pointer1Position.x) / 2,
      y: (pointer0Position.y + pointer1Position.y) / 2,
    }
    const pointersDistance = Math.max(1, Math.sqrt(
      (pointer1Position.x - pointer0Position.x) ** 2
      + (pointer1Position.y - pointer0Position.y) ** 2
    ));
    const pointersRotation = Math.atan(
      (pointer1Position.y - pointer0Position.y)
      / (pointer1Position.x - pointer0Position.x)
    ) * 180 / Math.PI + 360;

    // position
    if (pointermoveBeforePositionOnStage.current !== null) {
      const movementX = midpointPosition.x - pointermoveBeforePositionOnStage.current.x;
      const movementY = midpointPosition.y - pointermoveBeforePositionOnStage.current.y;

      group.position({
        x: group.x() + movementX,
        y: group.y() + movementY
      });
      dragVelocity.current = {x: movementX, y: movementY};
    }
    pointermoveBeforePositionOnStage.current = midpointPosition;

    // scale
    console.log("scale");
    console.log(beforePointersDistance.current);
    console.log(pointersDistance);
    
    if (beforePointersDistance.current !== null) {
      const scale = pointersDistance / beforePointersDistance.current;
      scaleAt(midpointPosition.x, midpointPosition.y, scale);
    }
    beforePointersDistance.current = pointersDistance;

    // rotation
    if (beforePointersRotation.current !== null) {
      const rotation = [
        pointersRotation - beforePointersRotation.current,
        pointersRotation - beforePointersRotation.current + 180,
        pointersRotation - beforePointersRotation.current - 180
      ].sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      rotateAt(midpointPosition.x, midpointPosition.y, rotation);
    }
    beforePointersRotation.current = pointersRotation;
  }
  
  const handleMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.buttons !== 0) return;

    pointermoveBeforePositionOnStage.current = null;
    
    if(mode === "draw") {
      set(child(drawingLineRef.current!, "isDrawing"), false);
      drawingLineRef.current = null;
    } else if (mode === "erase") {
      eraseMousemoveBeforePositionOnGroup.current = null;
    } else if (mode === "move") {
      applyMomentum();
    }
  }

  const handleTouchEnd = (event: Konva.KonvaEventObject<TouchEvent>) => {
    pointermoveBeforePositionOnStage.current = null;
    beforePointersDistance.current = null;
    beforePointersRotation.current = null;

    if(mode === "draw") {
      set(child(drawingLineRef.current!, "isDrawing"), false);
      drawingLineRef.current = null;
    } else if (mode === "erase") {
      eraseMousemoveBeforePositionOnGroup.current = null;
    } else if (mode === "move") {
      if (event.evt.touches.length > 0) return;

      applyMomentum();
    }
  }

  const applyMomentum = () => {
    const group = groupRef.current;
      if (group === null) return;

      const FLICTION = 10; // 時間的止まりやすさ
      const WEIGHT = 500; // 慣性の強さ
      const signAX = Math.sign(dragVelocity.current.x);
      const signAY = Math.sign(dragVelocity.current.y);
      const dragSpeed = Math.sqrt(dragVelocity.current.x ** 2 + dragVelocity.current.y ** 2); // 速さ
      const stoppingDuration = Math.sqrt(dragSpeed) / FLICTION; // 停止までの時間
      const stoppingDistanceX = (Math.sqrt(Math.abs(dragVelocity.current.x)/100) * WEIGHT) * signAX;
      const stoppingDistanceY = (Math.sqrt(Math.abs(dragVelocity.current.y)/100) * WEIGHT) * signAY;  

      if (dragSpeed > 5) {
        dragMomentum.current =  new Konva.Tween({
          node: group,
          duration: stoppingDuration,
          x: group.x() + (stoppingDistanceX || 0),
          y: group.y() + (stoppingDistanceY || 0),
          easing: Konva.Easings.EaseOut,
        }).play();
      }
      
      dragVelocity.current = {x: 0, y: 0};
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const group = groupRef.current

    if(stage === null || group === null) return;

    // 慣性を止める
    dragMomentum.current?.destroy();

    if (event.evt.ctrlKey) {
      rotateAt(width / 2, height / 2, event.evt.deltaY * ROTATE_BY);
    } else {
      const scale = event.evt.deltaY > 0 ? 1 / SCALE_BY : SCALE_BY;
      const pointerPositionOnStage = stage.getPointerPosition();
      scaleAt(pointerPositionOnStage!.x, pointerPositionOnStage!.y, scale);
    }
  }

  useEffect(() => {
    if(typeof imageUrlRef !== "undefined") {
      onValue(imageUrlRef, (snapshot) => {
        if (snapshot.val() !== null) setImageUrl(snapshot.val());
      });
    }
  });

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
    if (typeof linesRef !== "undefined"){
      onChildAdded(linesRef, (snapshot) => {
        setLines(oldLines => ({...oldLines, [snapshot.key!]: snapshot.val()}));

        // 自分以外の線なら以降の更新をlistenする
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
    }
  }, [linesRef]);

  return (
    <>
      <Stage
        height={height}
        width={width}
        ref={stageRef}
        onWheel={handleWheel}
      >
        <Layer>
          <Group
            ref={groupRef}
            draggable={false}
            onPointerDown={handleMouseDown}
            onMouseMove={handleOnePointerMove}
            onTouchMove={handleTouchmove}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleTouchEnd}
          >
            <Rect
              height={BACKGROUND_SIZE}
              width={BACKGROUND_SIZE}
              offsetX={BACKGROUND_OFFSET}
              offsetY={BACKGROUND_OFFSET}
            />
            <MapImage url={imageUrl} />
            {Object.entries(lines).map(([key,line]) => 
              <Line
                key={key}
                id={key}
                points={line.points}
                globalCompositeOperation={line.compositionMode}
                stroke={"red"}
                lineCap="round"
                strokeWidth={8}
            />)}
          </Group>
        </Layer>
      </Stage>
      <Overlay 
        mode={mode}
        imageUrlRef={imageUrlRef!}
        setMode={setMode}
        clearAllLines={clearAllLines}
        storageRoomRef={storageRoomRef.current}
       />
    </>
  )
}

export default Canvas
