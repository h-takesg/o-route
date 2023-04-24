import Konva from "konva";
import { useRef, useState } from "react";
import { Layer, Stage, Image, Group, Line, Rect } from "react-konva";
import useImage from "use-image";
import { useWindowSize } from "./hooks/useWindwosSize";
import { Lines, Mode } from "./types";
import { Point, Vector, clamp, closestToZero, intersectsLineSegment } from "./math";
import { Overlay } from "./Overlay";

const MapImage = ({url}: {url:string}) => {
  const [image] = useImage(url)
  return <Image image={image} />
};

type Props = {
  imageUrl: string;
  setImage: (image: File) => Promise<void>;
  lines: Lines;
  addPointToDrawingLine: ({x, y}: Point) => void;
  endDrawing: () => void;
  removeLines: (ids: string[]) => void;
  clearAllLines: () => void;
};

function Canvas({
  imageUrl,
  setImage,
  lines,
  addPointToDrawingLine,
  endDrawing,
  removeLines,
  clearAllLines
}: Props) {
  const [width, height] = useWindowSize();
  const [mode, setMode] = useState<Mode>("move");
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const pointerBeforeOnStage = useRef<Vector | null>(null);
  const beforePointersDistance = useRef<number | null>(null);
  const beforePointersRotation = useRef<number | null>(null);
  const eraseMousemoveBeforePositionOnGroup = useRef<Vector | null>(null);
  const dragVelocity = useRef(new Vector({x: 0, y: 0}));
  const dragMomentum = useRef<Konva.Tween | null>(null);
  const SCROLL_PER_SCALE = 160;
  const SCALE_BY = 1.1;
  const ROTATE_BY = 0.02;
  const SCALE_MIN = 0.1;
  const SCALE_MAX = 5;
  const BACKGROUND_SIZE = 80000;
  const BACKGROUND_OFFSET = BACKGROUND_SIZE * 2 / 5;
  const BACKGROUND_COLOR = "#dddddd";

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
    });
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
        addPointToDrawingLine({x: pointerOnGroup.x, y: pointerOnGroup.y});
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
          
          removeLines(toBeRemoved);
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
      endDrawing();
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
      endDrawing();
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

      const FLICTION = 4.15; // 時間的止まりやすさ
      const WEIGHT = 60; // 慣性の強さ
      const dragSpeed = Math.sqrt(dragVelocity.current.getSize()); // 速さ
      const stoppingDuration = Math.sqrt(dragSpeed) / FLICTION; // 停止までの時間
      const stoppingDistance = Math.sqrt(dragSpeed) * WEIGHT;
      const stoppingMovement = dragVelocity.current.getScaled(stoppingDistance / dragSpeed);

      if (dragSpeed > 2.5) {
        dragMomentum.current =  new Konva.Tween({
          node: group,
          duration: stoppingDuration,
          x: group.x() + stoppingMovement.x,
          y: group.y() + stoppingMovement.y,
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
      const scale = SCALE_BY ** (-event.evt.deltaY / SCROLL_PER_SCALE);
      const pointerPositionOnStage = stage.getPointerPosition();
      scaleAt(new Vector(pointerPositionOnStage!), scale);
    }
  }

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
              fill={BACKGROUND_COLOR}
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
        setMode={setMode}
        setImage={setImage}
        clearAllLines={clearAllLines}
       />
    </>
  )
}

export { Canvas };
