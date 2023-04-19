import { useState } from 'react';
import Canvas from './Canvas'
import { Overlay } from './Overlay'
import { DrawLine, Mode } from './types';

function App() {
  const [mode, setMode] = useState<Mode>("move");
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [imageUrl, setImageUrl] = useState<string>('./samplemap.jpg');

  return (
    <>
      <Canvas imageUrl={imageUrl} mode={mode} lines={lines} setLines={setLines} />
      <Overlay mode={mode} setImageUrl={setImageUrl} setMode={setMode} setLines={setLines} />
    </>
  )
}

export default App
