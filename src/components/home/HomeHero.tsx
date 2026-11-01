import { Box, Button, Stack, Typography } from "@mui/material";
import { FramedScreenshot } from "./FramedScreenshot";

type Props = {
  onEnterLocal: () => void;
  onEnterOnline: () => void;
};

function HomeHero({ onEnterLocal, onEnterOnline }: Props) {
  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: { xs: 3, md: 4 },
        alignItems: "center",
        mb: 6,
      }}
    >
      <Stack spacing={2}>
        <Typography component="h1" variant="h3">
          O-Route
        </Typography>
        <Typography variant="body1">
          オリエンテーリングの地図読みに使うホワイトボードです。地図画像を読み込み、拡大・縮小・回転しながら線を書き込めます。オンラインモードでは複数人で同じ画面を使えます。
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button variant="contained" size="large" data-testid="enter-local" onClick={onEnterLocal}>
            ローカルで始める
          </Button>
          <Button
            variant="contained"
            size="large"
            color="secondary"
            data-testid="enter-online"
            onClick={onEnterOnline}
          >
            オンラインで始める
          </Button>
        </Stack>
      </Stack>
      <FramedScreenshot
        src="/images/home/hero.webp"
        width={1440}
        height={900}
        alt="O-Route の画面。地図画像の上に線が描かれ、ツールバーが表示されている。"
        loading="eager"
      />
    </Box>
  );
}

export { HomeHero };
