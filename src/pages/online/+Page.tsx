import { ReactNode, useEffect, useState } from "react";

export { Page };

function Page() {
  const [content, setContent] = useState<ReactNode>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId");

    if (roomId === null) {
      window.location.href = "/errors/room_not_found";
      return;
    }

    import("../../components/OnlineCanvas").then((mod) => {
      const OnlineCanvas = mod.OnlineCanvas;
      setContent(<OnlineCanvas roomId={roomId} />);
    });
  }, []);

  return content;
}
