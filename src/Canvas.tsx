import Konva from "konva"
import { KeyboardEvent, KeyboardEventHandler, useCallback, useEffect, useRef, useState } from "react"
import { Layer, Rect, Stage, Image } from "react-konva"
import useImage from "use-image"

type Props = {
  size: {
    height: number,
    width: number
  }
}

const MapImage = () => {
  const [image] = useImage('./samplemap.jpg')
  return <Image image={image} />
}

function Canvas({size}: Props) {
  console.log("render Konva Stage");
  const stageRef = useRef<Konva.Stage>(null)
  const scaleBy = 1.1;
  const [rotation, setRotation] = useState(0)
  const [ctrlKey, setCtrlKey] = useState(false)

  const keydownHandler = useCallback((event: KeyboardEvent) => {
    if (event.ctrlKey) {
      setCtrlKey(true)
    }
  }, [])

  const keyupHandler = useCallback((event: KeyboardEvent) => {
    if (!event.ctrlKey) {
      setCtrlKey(false)
    }
  }, [])

  const wheelHandler = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    if (stageRef.current !== null) {
      if (event.evt.ctrlKey) {
        setRotation(rotation + 1 % 360)
      } else {
        const stage = stageRef.current
        const oldScale = stage.scaleX()
        const { x: pointerX, y: pointerY } = stage.getPointerPosition();
        const mousePointTo = {
          x: (pointerX - stage.x()) / oldScale,
          y: (pointerY - stage.y()) / oldScale,
        }
        const newScale = event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale});
        const newPos = {
          x: pointerX - mousePointTo.x * newScale,
          y: pointerY - mousePointTo.y * newScale,
        }
        stage.position(newPos);
        stage.batchDraw();
      } 
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", keydownHandler, false)
    document.addEventListener("keyup", keyupHandler, false)
  }, [])

  return (
    <Stage
      height={size.height}
      width={size.width}
      ref={stageRef}
      rotation={rotation}
      onWheel={wheelHandler}
      draggable={!ctrlKey}
    >
      <Layer>
        <MapImage />
      </Layer>
    </Stage>
  )
}

export default Canvas
