import { Box } from "@mui/material";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
}

function Overlay({children}: Props) {
  return (
    <Box
      sx={{
        position: "fixed",
        top: "0",
        margin: "1rem",
        display: "flex",
        flexDirection: "column",
        "@media screen and (max-width:600px)": {
          margin: "0rem",
        },
      }}
    >
      {children}
    </Box>
  );
}

export { Overlay };
