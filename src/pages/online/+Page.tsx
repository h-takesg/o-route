import { OnlineCanvas } from "../../components/OnlineCanvas";

export { Page };

function Page() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("roomId");

  if (roomId === null) {
    window.location.href = "/errors/room_not_found";
    return;
  }

  return (
    <>
      <OnlineCanvas roomId={roomId} />
    </>
  );
}
