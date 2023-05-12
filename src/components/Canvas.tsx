import Konva from "konva";
import { Dispatch, SetStateAction, useRef } from "react";
import { Layer, Stage, Group, Line, Rect } from "react-konva";
import { Mode } from "../types";
import { Lines } from "../models/LineModel";
import { Point, Vector, closestToZero } from "../math";
import { MapImage } from "./MapImage";
import { ViewModel } from "../models/ViewModel";

type Props = {
  width: number;
  height: number;
  mode: Mode;
  imageUrl: string;
  lines: Lines;
  addPointToDrawingLine: ({ x, y }: Point) => void;
  endDrawing: () => void;
  removeLines: (ids: string[]) => void;
  viewModel: ViewModel;
  setViewModel: Dispatch<SetStateAction<ViewModel>>;
};

function Canvas({
  width,
  height,
  mode,
  imageUrl,
  lines,
  addPointToDrawingLine,
  endDrawing,
  removeLines,
  viewModel,
  setViewModel,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const pointerLastMoveTime = useRef(0);
  const HOLD_THRESHOLD = 5;
  const pointerBeforeOnStage = useRef<Vector | null>(null);
  const beforePointersDistance = useRef<number | null>(null);
  const beforePointersRotation = useRef<number | null>(null);
  const eraseMousemoveBeforePositionOnGroup = useRef<Vector | null>(null);
  const dragVelocity = useRef(new Vector());
  const dragMomentum = useRef<Konva.Animation | null>(null);
  const SCALE_PER_SCROLL = 160;
  const SCALE_BY = 1.1;
  const ROTATE_BY = 0.02;
  const SCALE_MIN = 0.1;
  const SCALE_MAX = 5;
  const BACKGROUND_SIZE = 80000;
  const BACKGROUND_OFFSET = (BACKGROUND_SIZE * 2) / 5;
  const BACKGROUND_COLOR = "#dddddd";

  const handleMouseDown = () => {
    if (mode !== "move") return;

    pointerBeforeOnStage.current = null;
    beforePointersDistance.current = null;
    beforePointersRotation.current = null;

    if (dragMomentum.current !== null) {
      clearMomentum();
    }
  };

  const handleTouchmove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (event.evt.touches.length >= 2) {
      handleTwoPointerMove(event);
    } else {
      handleOnePointerMove(event);
    }
  };

  const handleOnePointerMove = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) => {
    if (event.evt instanceof MouseEvent && event.evt.buttons === 0) return;

    const group = groupRef.current;
    if (group === null) return;

    const pointerOnStage = new Vector({
      x:
        event.evt instanceof MouseEvent
          ? event.evt.pageX
          : event.evt.touches[0].pageX,
      y:
        event.evt instanceof MouseEvent
          ? event.evt.pageY
          : event.evt.touches[0].pageY,
    });
    const pointerOnGroup = group.getRelativePointerPosition();

    switch (mode) {
      case "move":
        if (pointerBeforeOnStage.current !== null) {
          const movement = pointerOnStage.getSub(pointerBeforeOnStage.current);
          setViewModel(viewModel.move(movement));
          dragVelocity.current = movement;
        }
        pointerLastMoveTime.current = Date.now();
        pointerBeforeOnStage.current = pointerOnStage;
        break;

      case "draw":
        addPointToDrawingLine(pointerOnGroup);
        break;

      case "erase":
        if (eraseMousemoveBeforePositionOnGroup.current !== null) {
          const beforePoint: Point =
            eraseMousemoveBeforePositionOnGroup.current;
          const pointerPoint: Point = pointerOnGroup;

          const toBeRemoved = lines.getCrossingLine(beforePoint, pointerPoint);
          removeLines(toBeRemoved);
        }
        eraseMousemoveBeforePositionOnGroup.current = new Vector(
          pointerOnGroup
        );
        break;
    }
  };

  const handleTwoPointerMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (mode !== "move") return;

    const pointer0 = new Vector({
      x: event.evt.touches[0].pageX,
      y: event.evt.touches[0].pageY,
    });
    const pointer1 = new Vector({
      x: event.evt.touches[1].pageX,
      y: event.evt.touches[1].pageY,
    });
    const pointer0ToPointer1 = pointer1.getSub(pointer0);
    const midpoint = pointer0.getAdd(pointer0ToPointer1.getScaled(1 / 2));
    const pointersDistance = Math.max(1, pointer0ToPointer1.getSize());
    const pointersRotation = pointer0ToPointer1.getRotationDegree();

    let newViewModel = viewModel;

    // position
    if (pointerBeforeOnStage.current !== null) {
      const movement = midpoint.getSub(pointerBeforeOnStage.current);
      newViewModel = newViewModel.move(movement);
      dragVelocity.current = movement;
    }
    pointerBeforeOnStage.current = midpoint;

    // scale
    if (beforePointersDistance.current !== null) {
      const scale = pointersDistance / beforePointersDistance.current;

      newViewModel = newViewModel.scaleAt(
        midpoint,
        scale,
        SCALE_MIN,
        SCALE_MAX
      );
    }
    beforePointersDistance.current = pointersDistance;

    // rotation
    if (beforePointersRotation.current !== null) {
      const rotation = closestToZero(
        pointersRotation - beforePointersRotation.current,
        pointersRotation - beforePointersRotation.current + 360,
        pointersRotation - beforePointersRotation.current - 360
      );

      newViewModel = newViewModel.rotateAt(midpoint, rotation);
    }
    beforePointersRotation.current = pointersRotation;

    setViewModel(newViewModel);
  };

  const handleMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.buttons !== 0) return;

    pointerBeforeOnStage.current = null;

    if (mode === "draw") {
      endDrawing();
    } else if (mode === "erase") {
      eraseMousemoveBeforePositionOnGroup.current = null;
    } else if (mode === "move") {
      applyMomentum();
    }
  };

  const handleTouchEnd = (event: Konva.KonvaEventObject<TouchEvent>) => {
    pointerBeforeOnStage.current = null;
    beforePointersDistance.current = null;
    beforePointersRotation.current = null;

    if (mode === "draw") {
      endDrawing();
    } else if (mode === "erase") {
      eraseMousemoveBeforePositionOnGroup.current = null;
    } else if (mode === "move") {
      if (event.evt.touches.length > 0) return;

      applyMomentum();
    }
  };

  const applyMomentum = () => {
    const now = Date.now();
    if (now - pointerLastMoveTime.current > HOLD_THRESHOLD) return;

    dragMomentum.current = new Konva.Animation((frame) => {
      if (typeof frame === "undefined") return;

      const FLICTION = 1.05;

      const speed = dragVelocity.current.getSize();

      if (speed < 1) {
        clearMomentum();
        return;
      }

      // position
      setViewModel((oldViewModel) => {
        const movement = dragVelocity.current;
        return oldViewModel.move(movement);
      });

      // velocity
      dragVelocity.current = dragVelocity.current.getScaled(1 / FLICTION);
    }).start();
  };

  const clearMomentum = () => {
    dragMomentum.current?.stop();
    dragMomentum.current = null;
    dragVelocity.current = new Vector();
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;

    if (stage === null) return;

    clearMomentum();

    if (event.evt.ctrlKey) {
      const center = new Vector({ x: width / 2, y: height / 2 });
      const rotation = event.evt.deltaY * ROTATE_BY;
      const newViewModel = viewModel.rotateAt(center, rotation);
      setViewModel(newViewModel);
    } else {
      const scale = SCALE_BY ** (-event.evt.deltaY / SCALE_PER_SCROLL);
      const pointerPositionOnStage = stage.getPointerPosition();
      if (pointerPositionOnStage === null) return;

      const newViewModel = viewModel.scaleAt(
        pointerPositionOnStage,
        scale,
        SCALE_MIN,
        SCALE_MAX
      );

      setViewModel(newViewModel);
    }
  };

  return (
    <>
      <Stage height={height} width={width} ref={stageRef}>
        <Layer>
          <Group
            ref={groupRef}
            x={viewModel.position.x}
            y={viewModel.position.y}
            scaleX={viewModel.scale}
            scaleY={viewModel.scale}
            rotation={viewModel.rotation}
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
            {lines.lines.entrySeq().map(([key, line]) => {
              return (
                <Line
                  key={key}
                  id={key}
                  points={line.points.toArray()}
                  globalCompositeOperation={line.compositionMode}
                  stroke="red"
                  lineCap="round"
                  strokeWidth={8}
                />
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </>
  );
}

export { Canvas };
