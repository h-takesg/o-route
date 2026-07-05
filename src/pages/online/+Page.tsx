import { ReactNode, useEffect, useState } from "react";
import { navigate } from "vike/client/router";

export { Page };

function Page() {
  const [content, setContent] = useState<ReactNode>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId");

    if (roomId === null) {
      navigate("/errors/room_not_found");
      return;
    }

    import("../../components/OnlineCanvas").then((mod) => {
      const OnlineCanvas = mod.OnlineCanvas;
      setContent(<OnlineCanvas roomId={roomId} />);
    });
  }, []);

  return content;
}
