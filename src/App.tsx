import Canvas from './Canvas'
import { initializeApp} from "firebase/app";

function App() {
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
      <Canvas roomId={roomId} firebaseApp={firebaseApp}/>
    </>
  )
}

export default App
