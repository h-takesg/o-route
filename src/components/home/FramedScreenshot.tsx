import { Box } from "@mui/material";

type Props = {
  src: string;
  width: number;
  height: number;
  alt: string;
  loading?: "lazy" | "eager";
};

function FramedScreenshot({ src, width, height, alt, loading = "lazy" }: Props) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        lineHeight: 0,
      }}
    >
      <img
        src={src}
        width={width}
        height={height}
        alt={alt}
        loading={loading}
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </Box>
  );
}

export { FramedScreenshot };
