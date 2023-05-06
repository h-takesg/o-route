import { useRef, useState } from "react";
import { Canvas } from "./Canvas";
import { Point, Vector } from "../math";
import { Lines, DrawLine, Mode } from "../types";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";

function LocalCanvas() {
  const [mode, setMode] = useState<Mode>("move");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [groupPosition, setGroupPosition] = useState(new Vector({x: 0, y: 0}));
  const [groupScale, setGroupScale] = useState(1);
  const [groupRotation, setGroupRotation] = useState(0);
  const drawingLineId = useRef<string | null>(null);
  const [lines, setLines] = useState<Lines>({});

  const setImage = async (image: File) => {
    const newUrl = URL.createObjectURL(image);
    setImageUrl(newUrl);
  };

  const addPointToDrawingLine = ({ x, y }: Point) => {
    if (
      drawingLineId.current === null ||
      !Object.keys(lines).includes(drawingLineId.current)
    ) {
      const newLine: DrawLine = {
        isDrawing: true,
        timestamp: Date.now().toString(),
        points: [x, y],
        compositionMode: "source-over",
      };
      drawingLineId.current = getNewId();

      setLines({
        ...lines,
        [drawingLineId.current]: newLine,
      });
    } else {
      const oldLine = lines[drawingLineId.current];

      const newLine = {
        ...oldLine,
        points: [...oldLine.points, x, y],
      };
      setLines({
        ...lines,
        [drawingLineId.current]: newLine,
      });
    }
  };

  const getNewId = () => {
    if (Object.keys(lines).length === 0) return "0";
    else {
      const ids = Object.keys(lines).map((e) => Number(e));
      return (Math.max(...ids) + 1).toString();
    }
  };

  const endDrawing = () => {
    setLines((oldLines) => {
      if (drawingLineId.current === null) return oldLines;

      const temp = { ...oldLines };
      temp[drawingLineId.current].isDrawing = false;
      drawingLineId.current = null;
      return temp;
    });
  };

  const removeLines = (ids: string[]) => {
    setLines((oldLines) => {
      const temp = { ...oldLines };
      ids.forEach((id) => delete temp[id]);
      return temp;
    });
  };

  const clearAllLines = () => {
    setLines({});
  };

  return (
    <>
      <Canvas
        mode={mode}
        imageUrl={imageUrl}
        lines={lines}
        addPointToDrawingLine={addPointToDrawingLine}
        endDrawing={endDrawing}
        removeLines={removeLines}
        groupPosition={groupPosition}
        groupScale={groupScale}
        groupRotation={groupRotation}
        setGroupPosition={setGroupPosition}
        setGroupScale={setGroupScale}
        setGroupRotation={setGroupRotation}
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
