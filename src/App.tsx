import { Ref, useLayoutEffect, useRef, useState } from 'react'
import Canvas from './Canvas'

function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({height: 0, width: 0});
  
  useLayoutEffect(() => {
    if (containerRef.current) {
      setContainerSize({
        height: containerRef.current.offsetHeight,
        width: containerRef.current.offsetWidth
      })
    }
  }, [])

  return (
    <div ref={containerRef} style={{overflow: 'hidden', height: '100dvh', width: '100dvw'}}>
      <Canvas size={containerSize} />
    </div>
  )
}

export default App
