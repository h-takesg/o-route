import { useState, useEffect } from 'react';
import Canvas from './Canvas'
import { Overlay } from './Overlay'
import { Lines, Mode } from './types';
import { initializeApp} from "firebase/app";

function App() {
  const [mode, setMode] = useState<Mode>("move");
  const [lines, setLines] = useState<Lines>({});
  const [imageUrl, setImageUrl] = useState<string>('./samplemap.jpg');

  const roomId = "hoge";
  
  const firebaseConfig = {
    apiKey: "AIzaSyCs6u1FqePbYk1b5dx8NcICCH7Xc8zUjBg",
    authDomain: "o-route.firebaseapp.com",
    databaseURL: "https://o-route-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "o-route",
    storageBucket: "o-route.appspot.com",
    messagingSenderId: "110047467361",
    appId: "1:110047467361:web:16cbf4ad30cf8940ef1720"
  };
  
  const firebaseApp = initializeApp(firebaseConfig);

  return (
    <>
      <Canvas imageUrl={imageUrl} mode={mode} lines={lines!} setLines={setLines} roomId={roomId} firebaseApp={firebaseApp}/>
      <Overlay mode={mode} setImageUrl={setImageUrl} setMode={setMode} setLines={setLines} />
    </>
  )
}

export default App
