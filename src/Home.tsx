import { Button } from "@mui/material";
import { FirebaseApp } from "firebase/app";
import { useNavigate } from "react-router-dom";
import { useDatabaseRef } from "./hooks/useDatabaseRef";
import { push } from "firebase/database";

function Home({firebaseApp}: {firebaseApp: FirebaseApp}) {
  const navigate = useNavigate();
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

  const goToHoge = () => {
    navigate("/rooms/hoge");
  }

  const goToError = () => {
    navigate("/rooms/a");
  }

  const enterLocalRoom = () => {
    navigate("/local");
  }

  const enterNewRoom = () => {
    const newRoomRef = push(roomsRef,{
      image: "",
      lines: {},
      timestamp: Date.now().toString()
    });

    navigate(`/rooms/${newRoomRef.key}`);
  }

  return (
    <>
      This is home page.
      <Button onClick={goToHoge}>go to hoge</Button>
      <Button onClick={goToError}>go to error</Button>
      <Button onClick={enterLocalRoom}>local</Button>
      <Button onClick={enterNewRoom}>online</Button>
    </>
  )
}

export { Home };
