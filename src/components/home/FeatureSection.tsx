import { Box, Card, CardContent, Typography } from "@mui/material";
import { DemoVideo } from "./DemoVideo";
import { FramedScreenshot } from "./FramedScreenshot";

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
            <Typography variant="body2" sx={{ mb: 2 }}>
              読み込んだ地図を拡大・縮小・回転しながら見られます。
            </Typography>
            <DemoVideo
              posterSrc="/images/home/rotate.webp"
              videoSrc="/images/home/rotate.webm"
              width={1152}
              height={864}
              alt="地図の移動・拡大・回転の操作例"
              playTestId="demo-play-rotate"
              videoTestId="demo-video-rotate"
            />
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              描画と消しゴム
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              ドラッグで線を描き、なぞった線を 1 本まるごと消せます。
            </Typography>
            <DemoVideo
              posterSrc="/images/home/draw-erase.webp"
              videoSrc="/images/home/draw-erase.webm"
              width={1152}
              height={864}
              alt="描画と消しゴムの操作例"
              playTestId="demo-play-draw-erase"
              videoTestId="demo-video-draw-erase"
            />
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              線の表示
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              線を不透明・半透明・非表示に切り替えられます。この設定は自分の画面にだけ反映されます。
            </Typography>
            <FramedScreenshot
              src="/images/home/opacity.webp"
              width={1152}
              height={864}
              alt="線の表示切替の例"
            />
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ gridColumn: { md: "1 / -1" } }}>
          <CardContent>
            <Typography component="h3" variant="h5" gutterBottom>
              視点共有（オンラインモードのみ）
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              リーダーの視点を他の人に送り、フォロワーはその視点に自動で追従します。
            </Typography>
            <DemoVideo
              posterSrc="/images/home/view-sharing.webp"
              videoSrc="/images/home/view-sharing.webm"
              width={2312}
              height={864}
              alt="視点共有の操作例"
              playTestId="demo-play-view-sharing"
              videoTestId="demo-video-view-sharing"
            />
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export { FeatureSection };
