import { Box, ToggleButton, ToggleButtonGroup, css } from "@mui/material"
import { Dispatch, SetStateAction, useState } from "react"
import OpenWithIcon from '@mui/icons-material/OpenWith';
import ModeIcon from '@mui/icons-material/Mode';
import ClearIcon from '@mui/icons-material/Clear';
import { Mode } from "./types";

type Props = {
  mode: Mode
  setMode: Dispatch<SetStateAction<Mode>>
}

function Overlay({mode, setMode}: Props) {
  const handleModeChange = (event: React.MouseEvent<HTMLElement>, nextView: Mode) => {
    if (nextView !== null) {
      setMode(nextView);
    }
  }

  return (
    <>
      <ToggleButtonGroup
        orientation="vertical"
        value={mode}
        exclusive
        size="large"
        color="primary"
        sx={{
          position: "fixed",
          top: "0",
          margin: "1rem",
          opacity: "100",
          background: "white",
          borderRadius: "4px"
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
          <ClearIcon fontSize="large" />
        </ToggleButton>
      </ToggleButtonGroup>
    </>
  )
}

export {Overlay}
