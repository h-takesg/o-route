import { useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { Point } from "../math";
import { Mode } from "../types";
import { Lines, DrawLine } from "../models/LineModel";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";
import { useWindowSize } from "../hooks/useWindwosSize";
import { ViewModel } from "../models/ViewModel";

function LocalCanvas() {
  const [width, height] = useWindowSize();
  const [mode, setMode] = useState<Mode>("move");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [viewModel, setViewModel] = useState(new ViewModel());
  const drawingLineId = useRef<string | null>(null);
  const [lines, setLines] = useState(new Lines());

  const setImage = async (image: File) => {
    const newUrl = URL.createObjectURL(image);
    setImageUrl(newUrl);
  };

  const addPointToDrawingLine = (point: Point) => {
    if (
      drawingLineId.current === null ||
      !lines.lines.keySeq().includes(drawingLineId.current)
    ) {
      const newLine = new DrawLine({ isDrawing: true }).addPoint(point);
      const [newLines, newKey] = lines.addLine(newLine);

      drawingLineId.current = newKey;
      setLines(newLines);
    } else {
      setLines(lines.addPoint(drawingLineId.current, point));
    }
  };

  const endDrawing = () => {
    if (drawingLineId.current === null) return;
    setLines(lines.endDrawing(drawingLineId.current));
    drawingLineId.current = null;
  };

  const removeLines = (ids: string[]) => {
    setLines(lines.removeLine(...ids));
  };

  const clearAllLines = () => {
    setLines(new Lines());
  };

  return (
    <>
      <Canvas
        width={width}
        height={height}
        mode={mode}
        imageUrl={imageUrl}
        lines={lines}
        addPointToDrawingLine={addPointToDrawingLine}
        endDrawing={endDrawing}
        removeLines={removeLines}
        viewModel={viewModel}
        setViewModel={setViewModel}
      />
      <Overlay>
        <BasicControl
          mode={mode}
          setMode={setMode}
          setImage={setImage}
          clearAllLines={clearAllLines}
        />
      </Overlay>
    </>
  );
}

export { LocalCanvas };
