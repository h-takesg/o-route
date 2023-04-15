import { Ref, useEffect, useRef } from "react"
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
  console.log(size);
  return (
    <Stage
      height={size.height}
      width={size.width}
    >
      <Layer>
        <Rect fill='red' x={100} y={100} width={300} height={200} />
        <MapImage />
      </Layer>
    </Stage>
  )
}

export default Canvas
