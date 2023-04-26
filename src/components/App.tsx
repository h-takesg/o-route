import { Route, Routes } from 'react-router-dom';
import { initializeApp} from "firebase/app";
import { Home } from './Home';
import { RoomNotFound } from './RoomNotFound';
import { OnlineCanvas } from './OnlineCanvas';
import { LocalCanvas } from './LocalCanvas';

function App() {
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
      <Routes>
        <Route path="/" element={<Home firebaseApp={firebaseApp} />} />
        <Route path="/local" element={<LocalCanvas />} />
        <Route path="/rooms/:roomId" element={<OnlineCanvas firebaseApp={firebaseApp}/>} />
        <Route path="/errors/room_not_found" element={<RoomNotFound />} />
      </Routes>
    </>
  )
}

export default App
