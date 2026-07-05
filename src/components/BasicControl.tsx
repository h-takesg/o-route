import { CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";
import OpenWithIcon_ from "@mui/icons-material/OpenWith";
import ModeIcon_ from "@mui/icons-material/Mode";
import ClearIcon_ from "@mui/icons-material/Clear";
import ImageIcon_ from "@mui/icons-material/Image";
import { FaEraser } from "react-icons/fa";
import React, { ChangeEvent, Dispatch, SetStateAction, useRef, useState } from "react";
import { Mode } from "../types";

// https://github.com/mui/material-ui/issues/37375
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const OpenWithIcon: typeof OpenWithIcon_ = OpenWithIcon_.default ?? OpenWithIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ModeIcon: typeof ModeIcon_ = ModeIcon_.default ?? ModeIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ClearIcon: typeof ClearIcon_ = ClearIcon_.default ?? ClearIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ImageIcon: typeof ImageIcon_ = ImageIcon_.default ?? ImageIcon_;

type Props = {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  setImage: (image: File) => Promise<void>;
  clearAllLines: () => void;
};

function BasicControl({ mode, setMode, setImage, clearAllLines }: Props) {
  const imageSelectButtonRef = useRef<HTMLInputElement>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, nextView: Mode) => {
    if (nextView !== null) {
      setMode(nextView);
    }
  };

  const handleAllClearButton = () => {
    clearAllLines();
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files === null || event.target.files.length !== 1) return;

    const selectedFile = event.target.files[0];

    const ACCEPT_FILETYPE_REGEX = /^image\/.*/;
    if (!ACCEPT_FILETYPE_REGEX.test(selectedFile.type)) return;

    setIsImageUploading(true);
    await setImage(event.target.files[0]);
    setIsImageUploading(false);
  };

  const handleImageSelectButton = () => {
    imageSelectButtonRef.current?.click();
  };

  return (
    <>
      <ToggleButtonGroup
        orientation="vertical"
        value={mode}
        exclusive
        size="large"
        color="primary"
        sx={{
          background: "white",
          borderRadius: "4px",
          boxShadow: 20,
          margin: "1rem",
        }}
        onChange={handleModeChange}
      >
        <ToggleButton value="move" data-testid="mode-move">
          <OpenWithIcon fontSize="large" />
        </ToggleButton>
        <ToggleButton value="draw" data-testid="mode-draw">
          <ModeIcon fontSize="large" />
        </ToggleButton>
        <ToggleButton value="erase" data-testid="mode-erase">
          <FaEraser style={{ fontSize: "1.7rem" }} />
        </ToggleButton>
      </ToggleButtonGroup>
      <ToggleButton
        value="allclear"
        data-testid="clear-all"
        sx={{
          background: "white",
          margin: "0 1rem",
          boxShadow: 20,
          ":hover": {
            background: "#f5f5f5",
          },
        }}
        onClick={handleAllClearButton}
      >
        <ClearIcon fontSize="large" />
      </ToggleButton>
      <ToggleButton
        value="load"
        data-testid="load-image"
        sx={{
          background: "white",
          margin: "1rem",
          boxShadow: 20,
          ":hover": {
            background: "#f5f5f5",
          },
        }}
        onClick={handleImageSelectButton}
      >
        <input
          ref={imageSelectButtonRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageSelect}
        />
        {isImageUploading ? (
          <CircularProgress color="inherit" size="2.1875rem" />
        ) : (
          <ImageIcon fontSize="large" />
        )}
      </ToggleButton>
    </>
  );
}

export { BasicControl };
