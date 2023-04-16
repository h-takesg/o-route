import Konva from "konva"
import { KeyboardEvent, useEffect, useRef, useState } from "react"
import { Layer, Stage, Image, Circle, Group } from "react-konva"
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
  const stageRef = useRef<Konva.Stage>(null)
  const groupRef = useRef<Konva.Group>(null)
  const scaleBy = 1.1;
  const rotateBy = 0.02;
  const [ctrlKey, setCtrlKey] = useState(false)

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
    if(event.evt.ctrlKey && event.evt.buttons > 0) {
      console.log(groupRef.current?.getPosition())
    }
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
        rotateAt(size.width / 2, size.height / 2, event.evt.deltaY * rotateBy);
      } else {
        const oldScale = group.scaleX()
        const { x: pointerX, y: pointerY } = stage.getPointerPosition()!;
        const mousePointTo = {
          x: (pointerX - group.x()) / oldScale,
          y: (pointerY - group.y()) / oldScale,
        }
        const newScale = event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
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
      height={size.height}
      width={size.width}
      ref={stageRef}
      onMouseMove={handleMousemove}
      onWheel={handleWheel}
    >
      <Layer
      >
        <Group
        ref={groupRef}
        draggable={!ctrlKey}
        >
          <MapImage />
        </Group>
        <Circle fill="red" radius={10} x={size.width/2} y={size.height/2} />
      </Layer>
    </Stage>
  )
}

export default Canvas
