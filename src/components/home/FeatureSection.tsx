import { Box, Card, CardContent, Typography } from "@mui/material";

function FeatureSection() {
  return (
    <Box component="section" sx={{ mb: 6 }}>
      <Typography component="h2" variant="h4" gutterBottom>
        機能
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 3,
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              地図の移動・拡大・回転
            </Typography>
            <Typography variant="body2">
              読み込んだ地図を拡大・縮小・回転しながら見られます。
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              描画と消しゴム
            </Typography>
            <Typography variant="body2">
              ドラッグで線を描き、なぞった線を 1 本まるごと消せます。
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              線の表示
            </Typography>
            <Typography variant="body2">
              線を不透明・半透明・非表示に切り替えられます。この設定は自分の画面にだけ反映されます。
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              視点共有（オンラインモードのみ）
            </Typography>
            <Typography variant="body2">
              リーダーの視点を他の人に送り、フォロワーはその視点に自動で追従します。
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export { FeatureSection };
