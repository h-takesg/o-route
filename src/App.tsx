import { useState } from 'react';
import Canvas from './Canvas'
import { Overlay } from './Overlay'
import { Mode } from './types';

function App() {
  const [mode, setMode] = useState<Mode>("move");

  return (
    <>
      <Canvas mode={mode} />
      <Overlay mode={mode} setMode={setMode} />
    </>
  )
}

export default App
