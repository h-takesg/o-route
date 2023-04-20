import Konva from "konva"
import { useEffect, useRef, useState } from "react"
import { Layer, Stage, Image, Group, Line, Rect } from "react-konva"
import useImage from "use-image"
import { useWindowSize } from "./hooks/useWindwosSize"
import { Lines, Mode } from "./types"
import { Point, intersectsLineSegment, rotateVector } from "./math"
import { DatabaseReference, child, off, onValue, push, remove, set, update } from "firebase/database";
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
  const [ctrlKey, setCtrlKey] = useState(false)
  const drawingLineRef = useRef<DatabaseReference | null>(null);
  const linesRef = useDatabaseRef(firebaseApp, `rooms/${roomId}/lines`);
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

  const clearAllLines = () => {
    remove(linesRef!);
  }
  
  const handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
    dragVelocity.current = {x: -event.evt.movementX, y: -event.evt.movementY};
  }
  
  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    const group = groupRef.current;
    if (group === null) return;
    
    const FLICTION = 10; // 時間的止まりやすさ
    const WEIGHT = 500; // 慣性の強さ
    const signAX = -1 * Math.sign(dragVelocity.current.x);
    const signAY = -1 * Math.sign(dragVelocity.current.y);
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
  
  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== "move") return;
    
    if (dragMomentum.current !== null) {
      dragMomentum.current.destroy();
      dragMomentum.current = null;
    }
  }

  const handleMousemove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== "draw" && mode !== "erase") return;
    if (event.evt.buttons === 0) return;

    const group = groupRef.current;
    if (group === null) return;

    const pointerOnGroup = group.getRelativePointerPosition();
    
    if (mode === "draw"){
      if (typeof linesRef === "undefined") return;

      if (drawingLineRef.current === null) {
        drawingLineRef.current = push(linesRef);
        set(drawingLineRef.current, {
          timestamp: Date.now().toString(),
          points: [pointerOnGroup.x, pointerOnGroup.y],
          compositionMode: "source-over"
        });
      } else {
        update(drawingLineRef.current, {
          points: [...lines[drawingLineRef.current.key!].points, pointerOnGroup.x, pointerOnGroup.y]
        });
      }
    } else if(mode === "erase") {
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
    }
  }
  
  const handleMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.buttons !== 0) return;
    
    if(mode === "draw") {
      drawingLineRef.current = null;
    } else if (mode === "erase") {
      eraseMousemoveBeforePositionOnGroup.current = null;
    }
  }
  
  const handleKeydown = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;

    setCtrlKey(event.ctrlKey);
  }
  
  const handleKeyup = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;
    
    setCtrlKey(event.ctrlKey);
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
      const oldScale = group.scaleX()
      const pointerOnStage = stage.getPointerPosition()!;
      const pointerOnGroupNoRotation = {
        x: (pointerOnStage.x - group.x()) / oldScale,
        y: (pointerOnStage.y - group.y()) / oldScale
      };
      const newScale = Math.max(SCALE_MIN, Math.min(event.evt.deltaY > 0 ? oldScale / SCALE_BY : oldScale * SCALE_BY, SCALE_MAX));
      group.scale({ x: newScale, y: newScale});
      const newPos = {
        x: pointerOnStage.x - pointerOnGroupNoRotation.x * newScale,
        y: pointerOnStage.y - pointerOnGroupNoRotation.y * newScale,
      }
      group.position(newPos);
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown, false);
    document.addEventListener("keyup", handleKeyup, false);
  }, []);

  useEffect(() => {
    if (typeof linesRef !== "undefined"){
      onValue(linesRef, (snapshot) => {
        setLines(snapshot.val() ?? {});
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
            draggable={mode === "move" && !ctrlKey}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMousemove}
            onMouseUp={handleMouseUp}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
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
      <Overlay mode={mode} setImageUrl={setImageUrl} setMode={setMode} clearAllLines={clearAllLines} />
    </>
  )
}

export default Canvas
