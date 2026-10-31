import { Button } from "@mui/material";
import { navigate } from "vike/client/router";

function InvalidRoomKey() {
  const gotoHome = () => {
    navigate("/");
  };

  return (
    <div
      data-testid="invalid-room-key"
      style={{
        maxWidth: "35rem",
        margin: "1rem auto",
        padding: "0 2rem",
      }}
    >
      <h1 style={{ color: "#ff3333" }}>ルームの鍵がありません</h1>
      <p>
        共有された URL は #
        以降も含めてすべてコピーしてください．鍵が欠けているか正しくないと，ルームの内容を復号できません．
      </p>
      <div style={{ width: "100%" }}>
        <Button variant="contained" style={{ margin: "0 auto" }} onClick={gotoHome}>
          Home
        </Button>
      </div>
    </div>
  );
}

export { InvalidRoomKey };
