import Konva from "konva"
import { useRef } from "react"
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

  const wheelHandler = (event: Konva.KonvaEventObject<WheelEvent>) => {
    console.log(event)
    event.evt.preventDefault()
    if (stageRef.current !== null) {
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

  return (
    <Stage
      height={size.height}
      width={size.width}
      ref={stageRef}
      onWheel={wheelHandler}
      draggable
    >
      <Layer>
        <Rect fill='red' x={100} y={100} width={300} height={200} />
        <MapImage />
      </Layer>
    </Stage>
  )
}

export default Canvas
