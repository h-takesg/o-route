import { Box, Stack, Typography } from "@mui/material";

function HomeHero() {
  return (
    <Box component="section" sx={{ mb: 6 }}>
      <Stack spacing={2}>
        <Typography component="h1" variant="h3" sx={{ fontWeight: 700 }}>
          O-Route
        </Typography>
        <Typography variant="body1">
          オリエンテーリングの地図読みに使うホワイトボードです。地図画像を読み込み、拡大・縮小・回転しながら線を書き込めます。オンラインモードでは複数人で同じ画面を使えます。
        </Typography>
      </Stack>
    </Box>
  );
}

export { HomeHero };
