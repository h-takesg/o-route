import { Canvas } from "./Canvas";
import { useEffect, useState } from "react";
import { LineOpacity, Mode, ViewMode } from "../types";
import { Overlay } from "./Overlay";
import { BasicControl } from "./BasicControl";
import { LineOpacityControl } from "./LineOpacityControl";
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
  const [lineOpacity, setLineOpacity] = useState<LineOpacity>("opaque");

  const { imageUrl, setImage, uploadError, clearUploadError } = useOnlineRoomImage(roomId);
  const { lines, addPointToDrawingLine, endDrawing, removeLines, clearAllLines } =
    useOnlineLines(roomId);

  useEffect(() => {
    if (uploadError === null) return;
    alert(uploadError);
    clearUploadError();
  }, [uploadError, clearUploadError]);

  useViewSharing(roomId, viewMode, setViewMode, viewModel, setViewModel, width, height);

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
        lineOpacity={lineOpacity}
      />
      <Overlay>
        <BasicControl
          mode={mode}
          setMode={setMode}
          setImage={setImage}
          clearAllLines={clearAllLines}
        />
        <LineOpacityControl lineOpacity={lineOpacity} setLineOpacity={setLineOpacity} />
        <ViewSharingControl viewMode={viewMode} setViewMode={setViewMode} />
      </Overlay>
    </>
  );
}

export { OnlineCanvas };
