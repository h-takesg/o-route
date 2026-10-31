import { ReactNode, useEffect, useState } from "react";
import { navigate } from "vike/client/router";
import { importRoomKey, parseRoomKeyFromHash } from "../../crypto/roomCrypto";

export { Page };

function Page() {
  const [content, setContent] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId");

    if (roomId === null) {
      navigate("/errors/room_not_found");
      return;
    }

    const encodedKey = parseRoomKeyFromHash(window.location.hash);
    if (encodedKey === null) {
      navigate("/errors/invalid_room_key");
      return;
    }

    Promise.all([
      importRoomKey(encodedKey).catch(() => null),
      import("../../components/OnlineCanvas"),
    ]).then(([key, mod]) => {
      if (cancelled) return;
      if (key === null) {
        navigate("/errors/invalid_room_key");
        return;
      }
      const OnlineCanvas = mod.OnlineCanvas;
      setContent(<OnlineCanvas roomId={roomId} roomKey={key} />);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return content;
}
