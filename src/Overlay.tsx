import { Box, CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material"
import React, { ChangeEvent, Dispatch, SetStateAction, useRef, useState } from "react"
import OpenWithIcon from '@mui/icons-material/OpenWith';
import ModeIcon from '@mui/icons-material/Mode';
import ClearIcon from '@mui/icons-material/Clear';
import ImageIcon from '@mui/icons-material/Image';
import {FaEraser} from 'react-icons/fa';
import { Mode } from "./types";

type Props = {
  mode: Mode;
  setMode: Dispatch<SetStateAction<Mode>>;
  setImage: (image: File) => Promise<void>;
  clearAllLines: () => void;
}

function Overlay({mode, setMode, setImage, clearAllLines}: Props) {
  const imageSelectButtonRef = useRef<HTMLInputElement>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, nextView: Mode) => {
    if (nextView !== null) {
      setMode(nextView);
    }
  }

  const handleAllClearButton = () => {
    clearAllLines();
  }

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files === null || event.target.files.length !== 1) return;

    const selectedFile = event.target.files[0];

    const ACCEPT_FILETYPE_REGEX = /^image\/.*/;
    if (!ACCEPT_FILETYPE_REGEX.test(selectedFile.type)) return;

    setIsImageUploading(true);
    await setImage(event.target.files[0]);
    setIsImageUploading(false);
  }

  const handleImageSelectButton = () => {
    imageSelectButtonRef.current?.click();
  }

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          top: "0",
          margin: "1rem",
          display: "flex",
          flexDirection: "column",
          "@media screen and (max-width:600px)": {
            margin: "0rem"
          }
        }}
      >
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
            margin: "1rem"
          }}
          onChange={handleModeChange}
        >
          <ToggleButton value="move">
            <OpenWithIcon fontSize="large" />
          </ToggleButton>
          <ToggleButton value="draw">
            <ModeIcon fontSize="large" />
          </ToggleButton>
          <ToggleButton value="erase">
            <FaEraser style={{fontSize: "1.7rem"}}/>
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButton value="allclear"
          sx={{
            background: "white",
            margin: "0 1rem",
            boxShadow: 20,
            ":hover": {
              background: "#f5f5f5"
            }
          }}
          onClick={handleAllClearButton}
        >
          <ClearIcon fontSize="large"/>
        </ToggleButton>
        <ToggleButton value="load" 
          sx={{
            background: "white",
            margin: "1rem",
            boxShadow: 20,
            ":hover": {
              background: "#f5f5f5"
            }
          }}
          onClick={handleImageSelectButton}
        >
          <input ref={imageSelectButtonRef} type="file" accept="image/*" hidden onChange={handleImageSelect}/>
          {(isImageUploading) ? 
              <CircularProgress color="inherit" size="2.1875rem" />
            : <ImageIcon fontSize="large"/>}
        </ToggleButton>
      </Box>
    </>
  )
}

export {Overlay}
