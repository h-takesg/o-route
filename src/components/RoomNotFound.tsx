import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

function RoomNotFound() {
  const navigate = useNavigate();

  const gotoHome = () => {
    navigate("/");
  };

  return (
    <div
      style={{
        maxWidth: "35rem",
        margin: "1rem auto",
        padding: "0 2rem",
      }}
    >
      <h1 style={{ color: "#ff3333" }}>ルームが見つかりませんでした</h1>
      <p>URLが間違っているかルームの有効期限が切れているかもしれません．</p>
      <div style={{ width: "100%" }}>
        <Button
          variant="contained"
          style={{ margin: "0 auto" }}
          onClick={gotoHome}
        >
          Home
        </Button>
      </div>
    </div>
  );
}

export { RoomNotFound };
