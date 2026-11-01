import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import OpenWithIcon_ from "@mui/icons-material/OpenWith";
import ModeIcon_ from "@mui/icons-material/Mode";
import ClearIcon_ from "@mui/icons-material/Clear";
import ImageIcon_ from "@mui/icons-material/Image";
import Circle_ from "@mui/icons-material/Circle";
import Contrast_ from "@mui/icons-material/Contrast";
import RadioButtonUnchecked_ from "@mui/icons-material/RadioButtonUnchecked";
import Person_ from "@mui/icons-material/Person";
import People_ from "@mui/icons-material/People";
import type { ReactNode } from "react";
import { FaEraser, FaChessKing } from "react-icons/fa";

// https://github.com/mui/material-ui/issues/37375
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const OpenWithIcon: typeof OpenWithIcon_ = OpenWithIcon_.default ?? OpenWithIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ModeIcon: typeof ModeIcon_ = ModeIcon_.default ?? ModeIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ClearIcon: typeof ClearIcon_ = ClearIcon_.default ?? ClearIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const ImageIcon: typeof ImageIcon_ = ImageIcon_.default ?? ImageIcon_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Circle: typeof Circle_ = Circle_.default ?? Circle_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Contrast: typeof Contrast_ = Contrast_.default ?? Contrast_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// prettier-ignore
const RadioButtonUnchecked: typeof RadioButtonUnchecked_ = RadioButtonUnchecked_.default ?? RadioButtonUnchecked_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const Person: typeof Person_ = Person_.default ?? Person_;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const People: typeof People_ = People_.default ?? People_;

const eraserIconStyle = { fontSize: "1.7rem" } as const;
const chessKingIconStyle = { fontSize: "1.7rem" } as const;

type ControlRow = {
  icons: ReactNode;
  name: string;
  description: string;
};

const controlRows: ControlRow[] = [
  {
    icons: <OpenWithIcon fontSize="large" />,
    name: "移動",
    description: "移動モードでドラッグして画面を移動します。",
  },
  {
    icons: <ModeIcon fontSize="large" />,
    name: "ペン",
    description: "ドラッグで赤い線を描きます。",
  },
  {
    icons: <FaEraser style={eraserIconStyle} />,
    name: "消しゴム",
    description:
      "ドラッグでなぞった線を 1 本まるごと消します。線の一部だけを消すことはできません。オンラインモードでは他の人の線も消せます。",
  },
  {
    icons: <ClearIcon fontSize="large" />,
    name: "全消し",
    description:
      "すべての線を消します。画像は残ります。オンラインモードではルーム全員の線が消えます。",
  },
  {
    icons: <ImageIcon fontSize="large" />,
    name: "画像選択",
    description:
      "地図画像を読み込みます。すでに画像がある場合は置き換わります。画像ファイルのみ、20MB 未満まで対応しています。PDF は読み込めません。オンラインモードではルーム全員の画像が置き換わります。",
  },
  {
    icons: (
      <Stack direction="row" spacing={0.5}>
        <Circle fontSize="large" />
        <Contrast fontSize="large" />
        <RadioButtonUnchecked fontSize="large" />
      </Stack>
    ),
    name: "線の表示",
    description:
      "線を不透明・半透明・非表示に切り替えます。この設定は自分の画面にだけ反映されます。",
  },
  {
    icons: (
      <Stack direction="row" spacing={0.5}>
        <Person fontSize="large" />
        <FaChessKing style={chessKingIconStyle} />
        <People fontSize="large" />
      </Stack>
    ),
    name: "視点共有",
    description:
      "共有なし：各自が自由に操作します。リーダー：自分の視点を他の人に送ります。フォロワー：リーダーの視点に自動で追従します。リーダーは 1 人です。後からリーダーを選んだ人がリーダーになり、それまでのリーダーはフォロワーに切り替わります。フォロワーはリーダーの表示範囲がすべて収まる倍率で表示します。画面の縦横比が大きく違うと、表示が小さくなります。",
  },
];

function ControlsTable() {
  return (
    <Box component="section" sx={{ mb: 6 }}>
      <Typography component="h2" variant="h4" gutterBottom>
        操作方法
      </Typography>
      <Typography component="h3" variant="h5" gutterBottom>
        画面の移動・拡大・回転
      </Typography>
      <Typography component="ul" variant="body2" sx={{ pl: 2.5, mb: 2 }}>
        <li>移動：移動モードでドラッグします。</li>
        <li>拡大・縮小：マウスホイールを回します。カーソルの位置を中心に拡大・縮小します。</li>
        <li>回転：Ctrl キー（Mac では control キー）を押しながらマウスホイールを回します。</li>
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        拡大・縮小と回転はどのモードでも使えます。
      </Typography>
      <Typography variant="body2" sx={{ mb: 3 }}>
        タッチ操作では、移動モードでスワイプして移動し、2 本指で拡大・縮小・回転します。
      </Typography>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 320 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: "8rem" }}>アイコン</TableCell>
              <TableCell sx={{ width: "7rem" }}>名前</TableCell>
              <TableCell>説明</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {controlRows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{row.icons}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export { ControlsTable };
