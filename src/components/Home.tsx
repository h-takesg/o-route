import { Card, CardContent, Typography } from "@mui/material";
import { FirebaseApp } from "firebase/app";
import { useNavigate } from "react-router-dom";
import { useDatabaseRef } from "../hooks/useDatabaseRef";
import { push } from "firebase/database";
import Markdown from "marked-react";
import homeDocument from "./documents/home_ja.md?raw";

function Home({firebaseApp}: {firebaseApp: FirebaseApp}) {
  const navigate = useNavigate();
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

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
    <div style={{
      margin: "3rem auto",
      width: "90%",
      maxWidth: "40rem"
    }}>
      <h1>O-Route</h1>
      <div style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        wordBreak: "keep-all",
        overflowWrap: "anywhere"
      }}>
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto"
          }}
          elevation={4}
          onClick={enterLocalRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              ローカル<wbr />モード
            </Typography>
            <Typography variant="body2">
              <p>ひとりで使う</p>
              <p>端末上に保存</p>
              <p>タブを閉じる or 更新するまで有効</p>
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto"
          }}
          elevation={4}
          onClick={enterNewRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              オンライン<wbr />モード
            </Typography>
            <Typography variant="body2">
              <p>みんなで使う</p>
              <p>サーバー上に保存</p>
              <p>24時間有効</p>
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
      </div>
      <Markdown value={homeDocument} />
    </div>
  );
}

export { Home };
