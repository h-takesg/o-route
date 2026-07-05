import Konva from "konva";
import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import { Layer, Stage, Group, Line, Rect } from "react-konva";
import { LineOpacity, Mode } from "../types";
import { Lines } from "../models/LineModel";
import { Point } from "../math";
import { MapImage } from "./MapImage";
import { ViewModel } from "../models/ViewModel";
import { useCanvasGestures } from "../hooks/useCanvasGestures";

// 中間段階の具体的な不透明度はここだけで管理する（id/UI には数値を出さない）
const LINE_OPACITY_VALUES: Record<LineOpacity, number> = {
  transparent: 0,
  translucent: 0.5,
  opaque: 1,
};

const BACKGROUND_SIZE = 80000;
const BACKGROUND_OFFSET = (BACKGROUND_SIZE * 2) / 5;
const BACKGROUND_COLOR = "#dddddd";

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
  lineOpacity: LineOpacity;
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
  lineOpacity,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const linesGroupRef = useRef<Konva.Group>(null);

  const {
    handleMouseDown,
    handleOnePointerMove,
    handleTouchmove,
    handleMouseUp,
    handleTouchEnd,
    handleWheel,
  } = useCanvasGestures({
    width,
    height,
    mode,
    lines,
    viewModel,
    setViewModel,
    addPointToDrawingLine,
    endDrawing,
    removeLines,
    groupRef,
    stageRef,
  });

  // 半透明時は線グループをキャッシュ（一度平坦化）してから不透明度を適用することで、
  // 線同士の重なりが濃くならず、レイヤー全体として均一な透明度になる。
  useEffect(() => {
    const node = linesGroupRef.current;
    if (node === null) return;

    node.clearCache();
    if (lineOpacity === "translucent" && lines.lines.size > 0) {
      node.cache();
    }
    node.getLayer()?.batchDraw();
  }, [lines, lineOpacity]);

  return (
    <div data-testid="canvas-stage">
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
            <Group ref={linesGroupRef} opacity={LINE_OPACITY_VALUES[lineOpacity]}>
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
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}

export { Canvas };
