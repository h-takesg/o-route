import { Canvas } from "./Canvas";
import { useState } from "react";
import { Mode, ViewMode } from "../types";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";
import { ViewSharingControl } from "./ViewSharingControl";
import { useWindowSize } from "../hooks/useWindowSize";
import { ViewModel } from "../models/ViewModel";
import { useOnlineRoomImage } from "../hooks/useOnlineRoomImage";
import { useOnlineLines } from "../hooks/useOnlineLines";
import { useViewSharing } from "../hooks/useViewSharing";

type Props = {
  roomId: string;
};

function OnlineCanvas({ roomId }: Props) {
  const [width, height] = useWindowSize();
  const [mode, setMode] = useState<Mode>("move");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [viewModel, setViewModel] = useState(new ViewModel());

  const { imageUrl, setImage } = useOnlineRoomImage(roomId);
  const {
    lines,
    addPointToDrawingLine,
    endDrawing,
    removeLines,
    clearAllLines,
  } = useOnlineLines(roomId);

  useViewSharing(
    roomId,
    viewMode,
    setViewMode,
    viewModel,
    setViewModel,
    width,
    height,
  );

  return (
    <>
      <Canvas
        width={width}
        height={height}
        mode={mode}
        imageUrl={imageUrl}
        lines={lines}
        addPointToDrawingLine={addPointToDrawingLine}
        endDrawing={endDrawing}
        removeLines={removeLines}
        viewModel={viewModel}
        setViewModel={setViewModel}
      />
      <Overlay>
        <BasicControl
          mode={mode}
          setMode={setMode}
          setImage={setImage}
          clearAllLines={clearAllLines}
        />
        <ViewSharingControl viewMode={viewMode} setViewMode={setViewMode} />
      </Overlay>
    </>
  );
}

export { OnlineCanvas };
