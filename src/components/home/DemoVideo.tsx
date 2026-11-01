import { Box, IconButton } from "@mui/material";
import PlayArrowIcon_ from "@mui/icons-material/PlayArrow";
import { useState } from "react";

// https://github.com/mui/material-ui/issues/37375
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const PlayArrowIcon: typeof PlayArrowIcon_ = PlayArrowIcon_.default ?? PlayArrowIcon_;

const frameSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  overflow: "hidden",
  lineHeight: 0,
} as const;

type Props = {
  posterSrc: string;
  videoSrc: string;
  width: number;
  height: number;
  alt: string;
  playTestId: string;
  videoTestId: string;
  loading?: "lazy" | "eager";
};

function DemoVideo({
  posterSrc,
  videoSrc,
  width,
  height,
  alt,
  playTestId,
  videoTestId,
  loading = "lazy",
}: Props) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <Box sx={frameSx}>
        <video
          src={videoSrc}
          poster={posterSrc}
          width={width}
          height={height}
          autoPlay
          muted
          playsInline
          controls
          preload="auto"
          data-testid={videoTestId}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ ...frameSx, position: "relative" }}>
      <img
        src={posterSrc}
        width={width}
        height={height}
        alt={alt}
        loading={loading}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconButton
          data-testid={playTestId}
          aria-label="動作を再生"
          onClick={() => {
            setPlaying(true);
          }}
          sx={{
            bgcolor: "rgba(0, 0, 0, 0.45)",
            color: "common.white",
            width: 56,
            height: 56,
            "&:hover": {
              bgcolor: "rgba(0, 0, 0, 0.55)",
            },
          }}
        >
          <PlayArrowIcon sx={{ fontSize: 32 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

export { DemoVideo };
