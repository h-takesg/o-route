import { Box, Button, Card, CardActions, CardContent, Stack, Typography } from "@mui/material";
import Person_ from "@mui/icons-material/Person";
import People_ from "@mui/icons-material/People";

// https://github.com/mui/material-ui/issues/37375
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Person: typeof Person_ = Person_.default ?? Person_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const People: typeof People_ = People_.default ?? People_;

type Props = {
  onEnterLocal: () => void;
  onEnterOnline: () => void;
};

function ModeCards({ onEnterLocal, onEnterOnline }: Props) {
  return (
    <Box component="section" sx={{ mb: 6 }}>
      <Typography component="h2" variant="h4" gutterBottom>
        モード
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
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Person color="primary" />
              <Typography component="h3" variant="h5">
                ローカルモード
              </Typography>
            </Stack>
            <Typography component="ul" variant="body2" sx={{ m: 0, pl: 2.5 }}>
              <li>ひとりで使います。</li>
              <li>画像と線はこの端末のブラウザ内だけで扱われ、サーバーには送られません。</li>
              <li>タブを閉じるか再読み込みすると消えます。</li>
            </Typography>
          </CardContent>
          <CardActions>
            <Button data-testid="enter-local-card" onClick={onEnterLocal}>
              ローカルで始める
            </Button>
          </CardActions>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <People color="primary" />
              <Typography component="h3" variant="h5">
                オンラインモード
              </Typography>
            </Stack>
            <Typography component="ul" variant="body2" sx={{ m: 0, pl: 2.5 }}>
              <li>複数人で使います。</li>
              <li>開始するたびに新しいルームが作られます。</li>
              <li>ルームの URL を共有すると、同じ画像と線を全員で見て書き込めます。</li>
              <li>URL を知っている人は誰でも閲覧・編集できます。</li>
              <li>ルームは作成から 24 時間有効で、その間は再読み込みしても内容が残ります。</li>
            </Typography>
          </CardContent>
          <CardActions>
            <Button data-testid="enter-online-card" onClick={onEnterOnline}>
              オンラインで始める
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Box>
  );
}

export { ModeCards };
