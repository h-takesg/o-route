import Konva from "konva"
import { Dispatch, KeyboardEvent, SetStateAction, useEffect, useRef, useState } from "react"
import { Layer, Stage, Image, Circle, Group, Line, Rect } from "react-konva"
import useImage from "use-image"
import { useWindowSize } from "./hooks/useWindwosSize"
import { DrawLine, Mode } from "./types"
import { Point, intersectsLineSegment } from "./math"

const MapImage = ({url}: {url:string}) => {
  const [image] = useImage(url)
  return <Image image={image} />
}

type Props = {
  imageUrl: string;
  mode: Mode;
  lines: DrawLine[];
  setLines: Dispatch<SetStateAction<DrawLine[]>>;
}

function Canvas({imageUrl, mode, lines, setLines}: Props) {
  const [width, height] = useWindowSize();
  const stageRef = useRef<Konva.Stage>(null)
  const groupRef = useRef<Konva.Group>(null)
  const scaleBy = 1.1;
  const rotateBy = 0.02;
  const scaleMin = 0.1;
  const scaleMax = 5;
  const backgroundSize = 80000;
  const backgroundOffset = backgroundSize * 2 / 5;
  const [ctrlKey, setCtrlKey] = useState(false)
  const [drawingLine, setDrawingLine] = useState<DrawLine>({points:[], id: "drawing", compositionMode:"source-over"});

  // Canvasの座標で中心を指定しGroupをdegree回転させる
  const rotateAt = (x: number, y: number, degree: number) => {
    const stage = stageRef.current;
    const group = groupRef.current;
    const angleRadian = degree * Math.PI / 180;

    if (stage === null) return;
    if (group === null) return;   

    const newX =  x +
                  (group.x() - x) * Math.cos(angleRadian) - 
                  (group.y() - y) * Math.sin(angleRadian);
    const newY =  y +
                  (group.x() - x) * Math.sin(angleRadian) +
                  (group.y() - y) * Math.cos(angleRadian);
    group.position({x: newX, y: newY});
    group.rotation((group.rotation() + degree)%360);
  }

  const handleMousemove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== "draw" && mode !== "erase") return;
    if (event.evt.buttons === 0) return;

    const stage = stageRef.current;
    const group = groupRef.current;
    if (stage === null || group === null) return;

    const rotation = group.rotation();
    const rotationRadian = rotation * Math.PI / 180;
    const scale = group.scaleX();
    const {x: pointerStageX, y: pointerStageY} = stage.getPointerPosition()!;
    const mousePointTo = {
      x: (pointerStageX - group.x()) / scale,
      y: (pointerStageY - group.y()) / scale,
    }

    if (mode === "draw"){
      const rotateCorrected = {
        x: mousePointTo.x * Math.cos(-rotationRadian) - mousePointTo.y * Math.sin(-rotationRadian),
        y: mousePointTo.x * Math.sin(-rotationRadian) + mousePointTo.y * Math.cos(-rotationRadian)
      }
  
      setDrawingLine({points: [...drawingLine.points, rotateCorrected.x, rotateCorrected.y], id: "drawing",compositionMode: "source-over"})
    } else if(mode === "erase") {
      const beforePointerPosition: Point = [event.evt.clientX - event.evt.movementX, event.evt.clientY - event.evt.movementY];
      const beforeMousePointTo: Point = [
        (beforePointerPosition[0] - group.x()) / scale,
        (beforePointerPosition[1] - group.y()) / scale
      ];
      const beforeRotateCorrected: Point = [
        beforeMousePointTo[0] * Math.cos(-rotationRadian) - beforeMousePointTo[1] * Math.sin(-rotationRadian),
        beforeMousePointTo[0] * Math.sin(-rotationRadian) + beforeMousePointTo[1] * Math.cos(-rotationRadian)
      ]
      const mousePoint: Point = [
        mousePointTo.x,
        mousePointTo.y
      ]
      const mouseRotateCorrected: Point = [
        mousePoint[0] * Math.cos(-rotationRadian) - mousePoint[1] * Math.sin(-rotationRadian),
        mousePoint[0] * Math.sin(-rotationRadian) + mousePoint[1] * Math.cos(-rotationRadian)
      ]

      const toBeRemoved: string[] = [];

      for (const line of lines) {
        for (let i = 0; i < line.points.length/2 - 1; i++) {
          if (intersectsLineSegment([beforeRotateCorrected, mouseRotateCorrected], [[line.points[i*2], line.points[i*2+1]],[line.points[i*2+2], line.points[i*2+3]]])) {
            toBeRemoved.push(line.id);
            break;
          }
        }
      }
      setLines(lines.filter(elem => !toBeRemoved.includes(elem.id)));
    }
  }

  const handleMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.evt.buttons !== 0) return;
    if (drawingLine.points.length === 0) return;

    const newLine = {
      ...drawingLine,
      id: Date.now().toString(),
    }

    setLines([...lines, newLine]);
    setDrawingLine({points: [], id: "drawing", compositionMode: "source-over"});
  }
  
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey) {
      setCtrlKey(true)
    }
  }

  const handleKeyup = (event: KeyboardEvent) => {
    if (!event.ctrlKey) {
      setCtrlKey(false)
    }
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    const group = groupRef.current

    if (stage !== null && group !== null) {
      if (event.evt.ctrlKey) {
        rotateAt(width / 2, height / 2, event.evt.deltaY * rotateBy);
      } else {
        const oldScale = group.scaleX()
        const { x: pointerX, y: pointerY } = stage.getPointerPosition()!;
        const mousePointTo = {
          x: (pointerX - group.x()) / oldScale,
          y: (pointerY - group.y()) / oldScale,
        }
        const newScale = Math.max(scaleMin, Math.min(event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy, scaleMax));
        group.scale({ x: newScale, y: newScale});
        const newPos = {
          x: pointerX - mousePointTo.x * newScale,
          y: pointerY - mousePointTo.y * newScale,
        }
        group.position(newPos);
        stage.batchDraw();
      } 
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown, false)
    document.addEventListener("keyup", handleKeyup, false)
  }, [])

  return (
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
          onMouseMove={handleMousemove}
          onMouseUp={handleMouseUp}
        >
          <Rect
            height={backgroundSize}
            width={backgroundSize}
            offsetX={backgroundOffset}
            offsetY={backgroundOffset}
          />
          <MapImage url={imageUrl} />
          {lines.map((line) => 
            <Line
              key={line.id}
              id={line.id}
              points={line.points}
              globalCompositeOperation={line.compositionMode}
              stroke={"red"}
              lineCap="round"
              strokeWidth={8}
          />)}
          <Line
            key="drawing"
            id="drawing"
            points={drawingLine.points}
            globalCompositeOperation={drawingLine.compositionMode}
            stroke={"blue"}
            lineCap="round"
            strokeWidth={8}
          />
        </Group>
        <Circle fill="red" radius={10} x={width/2} y={height/2} />
      </Layer>
    </Stage>
  )
}

export default Canvas
