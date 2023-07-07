import { Card, CardContent, Typography } from "@mui/material";
import { navigate } from "vite-plugin-ssr/client/router";
import { useDatabaseRef } from "../hooks/useDatabaseRef";
import { push, serverTimestamp } from "firebase/database";
import Markdown from "marked-react";
import homeDocument from "../documents/home_ja.md?raw";
import { firebaseApp } from "../firebase";

function Home() {
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

  const enterLocalRoom = () => {
    navigate("/local");
  };

  const enterNewRoom = () => {
    const newRoomRef = push(roomsRef, {
      image: "",
      lines: {},
      timestamp: serverTimestamp(),
    });

    if (newRoomRef.key === null) {
      alert("新しいルームの作成に失敗しました");
      return;
    }

    const query = new URLSearchParams([["roomId", newRoomRef.key]]);

    navigate(`/online?${query}`);
  };

  return (
    <div
      style={{
        margin: "3rem auto",
        width: "90%",
        maxWidth: "40rem",
      }}
    >
      <h1>O-Route</h1>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          wordBreak: "keep-all",
          overflowWrap: "anywhere",
        }}
      >
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto",
          }}
          elevation={4}
          onClick={enterLocalRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              ローカル
              <wbr />
              モード
            </Typography>
            <Typography variant="body2">
              ひとりで使う<br />
              端末上に保存<br />
              タブを閉じる or 更新するまで有効<br />
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto",
          }}
          elevation={4}
          onClick={enterNewRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              オンライン
              <wbr />
              モード
            </Typography>
            <Typography variant="body2">
              みんなで使う<br />
              サーバー上に保存<br />
              24時間有効<br />
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
