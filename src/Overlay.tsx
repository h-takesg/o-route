import { Box, ToggleButton, ToggleButtonGroup, css } from "@mui/material"
import { Dispatch, SetStateAction, useState } from "react"
import OpenWithIcon from '@mui/icons-material/OpenWith';
import ModeIcon from '@mui/icons-material/Mode';
import ClearIcon from '@mui/icons-material/Clear';
import ImageIcon from '@mui/icons-material/Image';
import {FaEraser} from 'react-icons/fa';
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
      <Box
        sx={{
          position: "fixed",
          top: "0",
          margin: "1rem",
          display: "flex",
          flexDirection: "column"
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
        <ToggleButton value="allclear" sx={{
          background: "white",
          margin: "0 1rem",
          boxShadow: 20,
          ":hover": {
            background: "#f5f5f5"
          }
        }}>
          <ClearIcon fontSize="large"/>
        </ToggleButton>
        <ToggleButton value="load" sx={{
          background: "white",
          margin: "1rem",
          boxShadow: 20,
          ":hover": {
            background: "#f5f5f5"
          }
        }}>
          <ImageIcon fontSize="large"/>
        </ToggleButton>
      </Box>
    </>
  )
}

export {Overlay}
