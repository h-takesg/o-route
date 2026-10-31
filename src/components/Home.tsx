import { Card, CardContent, Typography } from "@mui/material";
import { navigate } from "vike/client/router";
import { useDatabaseRef } from "../hooks/useDatabaseRef";
import { push, serverTimestamp, set } from "firebase/database";
import Markdown from "marked-react";
import homeDocument from "../documents/home_ja.md?raw";
import { firebaseApp } from "../firebase";
import {
  buildRoomKeyHash,
  createRoomKeyCheck,
  exportRoomKey,
  generateRoomKey,
} from "../crypto/roomCrypto";

function Home() {
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

  const enterLocalRoom = () => {
    navigate("/local");
  };

  const enterNewRoom = async () => {
    if (globalThis.crypto?.subtle === undefined) {
      alert("暗号化に対応していない環境です．https もしくは localhost で開いてください");
      return;
    }

    try {
      const newRoomRef = push(roomsRef);

      if (newRoomRef.key === null) {
        alert("新しいルームの作成に失敗しました");
        return;
      }

      const roomId = newRoomRef.key;
      const key = await generateRoomKey();
      const encodedKey = await exportRoomKey(key);
      const check = await createRoomKeyCheck(key, roomId);

      set(newRoomRef, {
        image: "",
        lines: {},
        timestamp: serverTimestamp(),
        e2ee: { v: 1, check },
      }).catch(() => {
        alert("新しいルームの作成に失敗しました");
      });

      const query = new URLSearchParams([["roomId", roomId]]);
      navigate(`/online?${query}${buildRoomKeyHash(encodedKey)}`);
    } catch {
      alert("新しいルームの作成に失敗しました");
    }
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
          data-testid="enter-local"
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
              ひとりで使う
              <br />
              端末上に保存
              <br />
              タブを閉じる or 更新するまで有効
              <br />
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
        <Card
          data-testid="enter-online"
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
              みんなで使う
              <br />
              サーバー上に保存
              <br />
              24時間有効
              <br />
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
