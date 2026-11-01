import { Box } from "@mui/material";
import { navigate } from "vike/client/router";
import { useDatabaseRef } from "../hooks/useDatabaseRef";
import { push, serverTimestamp, set } from "firebase/database";
import { firebaseApp } from "../firebase";
import {
  buildRoomKeyHash,
  createRoomKeyCheck,
  exportRoomKey,
  generateRoomKey,
} from "../crypto/roomCrypto";
import { ControlsTable } from "./home/ControlsTable";
import { FeatureSection } from "./home/FeatureSection";
import { HomeFooter } from "./home/HomeFooter";
import { HomeHero } from "./home/HomeHero";
import { ModeCards } from "./home/ModeCards";

function Home() {
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

  const enterLocalRoom = () => {
    navigate("/local");
  };

  const enterNewRoom = async () => {
    if (globalThis.crypto?.subtle === undefined) {
      alert("暗号化に対応していない環境です。https もしくは localhost で開いてください");
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
    <Box
      component="main"
      sx={{
        mx: "auto",
        width: "90%",
        maxWidth: "64rem",
        py: { xs: 3, md: 4 },
      }}
    >
      <HomeHero onEnterLocal={enterLocalRoom} onEnterOnline={enterNewRoom} />
      <ModeCards onEnterLocal={enterLocalRoom} onEnterOnline={enterNewRoom} />
      <FeatureSection />
      <ControlsTable />
      <HomeFooter />
    </Box>
  );
}

export { Home };
