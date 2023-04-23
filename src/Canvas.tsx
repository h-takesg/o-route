import Konva from "konva"
import { useEffect, useRef, useState } from "react"
import { Layer, Stage, Image, Group, Line, Rect } from "react-konva"
import useImage from "use-image"
import { useWindowSize } from "./hooks/useWindwosSize"
import { DrawLine, Lines, Mode } from "./types"
import { Point, Vector, clamp, closestToZero, intersectsLineSegment } from "./math"
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
  const [imageUrl, setImageUrl] = useState<string>('');
  const [mode, setMode] = useState<Mode>("move");
  const [lines, setLines] = useState<Lines>({});
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
  const imageUrlRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/image`);
  const storageRoomRef = useRef(ref(getStorage(firebaseApp), roomId));
  const pointerBeforeOnStage = useRef<Vector | null>(null);
  const beforePointersDistance = useRef<number | null>(null);
  const beforePointersRotation = useRef<number | null>(null);
  const eraseMousemoveBeforePositionOnGroup = useRef<Vector | null>(null);
  const dragVelocity = useRef(new Vector({x: 0, y: 0}));
  const dragMomentum = useRef<Konva.Tween | null>(null);
  const SCALE_BY = 1.1;
  const ROTATE_BY = 0.02;
  const SCALE_MIN = 0.1;
  const SCALE_MAX = 5;
  const BACKGROUND_SIZE = 80000;
  const BACKGROUND_OFFSET = BACKGROUND_SIZE * 2 / 5;

  // Canvasの座標で中心を指定しGroupをdegree回転させる
  const rotateAt = (centerOnStage: Vector, degree: number) => {
    const group = groupRef.current;
    if (group === null) return;   

    const SNAPPING_DEGREE = 90;

    const originalPositiveRotatedDegree = group.rotation() + degree + 360;
    // degreeが最も近いSNAPPING_DEGREEの倍数との差を求める
    const delta = (originalPositiveRotatedDegree + SNAPPING_DEGREE / 2) % SNAPPING_DEGREE + SNAPPING_DEGREE / 2;

    // snappingDegreeごとにスナップを付ける
    const snappedDegree = (Math.abs(delta) < 1) ? degree - delta : degree;

    const groupPositionOnStage = new Vector(group.position());
    const oldCenterToGroup = groupPositionOnStage.getSub(centerOnStage);
    const newCenterToGroup = oldCenterToGroup.getRotated(snappedDegree);
    const newPosition = centerOnStage.getAdd(newCenterToGroup);

    group.position(newPosition);
    group.rotation((group.rotation() + snappedDegree)%360);
  }

  // Canvasの座標で中心を指定しGroupをscale倍する
  const scaleAt = (centerOnStage: Vector, scale: number) => {
    const stage = stageRef.current;
    const group = groupRef.current;
    if (stage === null || group === null) return;

    const oldScale = group.scaleX();
    const oldGroupOnStage = new Vector(group.position());
    const centerOnGroupNoRotation = centerOnStage.getSub(oldGroupOnStage).getScaled(1 / oldScale);
    const newScale = clamp(SCALE_MIN, oldScale * scale, SCALE_MAX);
    const newGroupOnStage = centerOnStage.getAdd(centerOnGroupNoRotation.getScaled(newScale).getReverse());

    group.scale({ x: newScale, y: newScale});
    group.position(newGroupOnStage);
  }

  const clearAllLines = () => {
    remove(linesRef!);
  }
  
  const handleMouseDown = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (mode !== "move") return;

    pointerBeforeOnStage.current = null;
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
      handleOnePointerMove(event);
    }
  }

  const handleOnePointerMove = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.evt instanceof MouseEvent && event.evt.buttons === 0) return;

    const group = groupRef.current;
    if (group === null) return;

    const pointerOnStage = new Vector({
      x: (event.evt instanceof MouseEvent) ? event.evt.pageX: event.evt.touches[0].pageX,
      y: (event.evt instanceof MouseEvent) ? event.evt.pageY: event.evt.touches[0].pageY,
    })
    const pointerOnGroup = new Vector(group.getRelativePointerPosition());
    
    switch(mode){
      case "move":
        if (pointerBeforeOnStage.current !== null) {
          const movement = pointerOnStage.getSub(pointerBeforeOnStage.current);
          group.position(movement.getAdd(group.position()));
          dragVelocity.current = movement;
        }
        pointerBeforeOnStage.current = pointerOnStage;
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
          const newLine = {
            ...oldLine,
            points: [...oldLine.points, pointerOnGroup.x, pointerOnGroup.y]
          };
          setLines({
            ...lines,
            [drawingLineRef.current.key!]: newLine
          });
        }
        break;

      case "erase":
        if (eraseMousemoveBeforePositionOnGroup.current !== null) {
          const beforePoint: Point = eraseMousemoveBeforePositionOnGroup.current;
          const pointerPoint: Point = pointerOnGroup;
          
          const toBeRemoved: string[] = [];
          
          for (const key in lines) {
            const line = lines[key];
            for (let i = 0; i < line.points.length/2 - 1; i++) {
              if (intersectsLineSegment([beforePoint, pointerPoint], [{x: line.points[i*2], y: line.points[i*2+1]}, {x: line.points[i*2+2], y: line.points[i*2+3]}])) {
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

    const pointer0 = new Vector({
      x: event.evt.touches[0].pageX,
      y: event.evt.touches[0].pageY
    });
    const pointer1 = new Vector({
      x: event.evt.touches[1].pageX,
      y: event.evt.touches[1].pageY
    });
    const pointer0ToPointer1 = pointer1.getSub(pointer0);
    const midpoint = pointer0.getAdd(pointer0ToPointer1.getScaled(1/2));
    const pointersDistance = Math.max(1, pointer0ToPointer1.getSize());
    const pointersRotation = pointer0ToPointer1.getRotationDegree();   

    // position
    if (pointerBeforeOnStage.current !== null) {
      const movement = midpoint.getSub(pointerBeforeOnStage.current);
      group.position(movement.getAdd(group.position()));
      dragVelocity.current = movement;
    }
    pointerBeforeOnStage.current = midpoint;

    // scale    
    if (beforePointersDistance.current !== null) {
      const scale = pointersDistance / beforePointersDistance.current;
      scaleAt(new Vector(midpoint), scale);
    }
    beforePointersDistance.current = pointersDistance;

    // rotation
    if (beforePointersRotation.current !== null) {
      const rotation = closestToZero(
        pointersRotation - beforePointersRotation.current,
        pointersRotation - beforePointersRotation.current + 360,
        pointersRotation - beforePointersRotation.current - 360
      );
      rotateAt(new Vector(midpoint), rotation);
    }
    beforePointersRotation.current = pointersRotation;
  }
  
  const handleMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.buttons !== 0) return;

    pointerBeforeOnStage.current = null;
    
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
    pointerBeforeOnStage.current = null;
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
      const dragSpeed = Math.sqrt(dragVelocity.current.getSize()); // 速さ
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
      
      dragVelocity.current = new Vector({x: 0, y: 0});
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const group = groupRef.current

    if(stage === null || group === null) return;

    // 慣性を止める
    dragMomentum.current?.destroy();

    if (event.evt.ctrlKey) {
      rotateAt(new Vector({x: width / 2, y: height / 2}), event.evt.deltaY * ROTATE_BY);
    } else {
      const scale = event.evt.deltaY > 0 ? 1 / SCALE_BY : SCALE_BY;
      const pointerPositionOnStage = stage.getPointerPosition();
      scaleAt(new Vector(pointerPositionOnStage!), scale);
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
        >
        <Layer>
          <Group
            ref={groupRef}
            draggable={false}
            onWheel={handleWheel}
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
