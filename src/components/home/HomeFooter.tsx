import { Box, Link, Typography } from "@mui/material";

function HomeFooter() {
  return (
    <Box component="footer" sx={{ mb: 4 }}>
      <Typography component="h2" variant="h4" gutterBottom>
        注意
      </Typography>
      <Typography variant="body2" sx={{ mb: 4 }}>
        無保証です。データやルームが予告なく消えることも、期限を過ぎて残ることもあります。重要なデータの保管には使わないでください。
      </Typography>
      <Typography component="h2" variant="h4" gutterBottom>
        つくったひと
      </Typography>
      <Typography variant="body2">
        <Link href="https://twitter.com/tooktwi" target="_blank" rel="noopener noreferrer">
          @tooktwi
        </Link>
        <br />
        <Link href="https://github.com/h-takesg/o-route" target="_blank" rel="noopener noreferrer">
          GitHub
        </Link>
        <br />
        意見・要望は上記 Twitter または GitHub へ
      </Typography>
    </Box>
  );
}

export { HomeFooter };
