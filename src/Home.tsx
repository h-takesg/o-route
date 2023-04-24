import { Card, CardContent, Link, Typography } from "@mui/material";
import { FirebaseApp } from "firebase/app";
import { useNavigate } from "react-router-dom";
import { useDatabaseRef } from "./hooks/useDatabaseRef";
import { push } from "firebase/database";

function Home({firebaseApp}: {firebaseApp: FirebaseApp}) {
  const navigate = useNavigate();
  const roomsRef = useDatabaseRef(firebaseApp, "rooms");

  const enterLocalRoom = () => {
    navigate("/local");
  }

  const enterNewRoom = () => {
    const newRoomRef = push(roomsRef,{
      image: "",
      lines: {},
      timestamp: Date.now().toString()
    });

    navigate(`/rooms/${newRoomRef.key}`);
  }

  return (
    <div style={{
      margin: "3rem auto",
      width: "90%",
      maxWidth: "40rem"
    }}>
      <h1>O-Route</h1>
      <div style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        wordBreak: "keep-all",
        overflowWrap: "anywhere"
      }}>
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto"
          }}
          elevation={4}
          onClick={enterLocalRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              ローカル<wbr />モード
            </Typography>
            <Typography variant="body2">
              <p>ひとりで使う</p>
              <p>端末上に保存</p>
              <p>タブを閉じる or 更新するまで有効</p>
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            width: "45%",
            margin: "1rem auto"
          }}
          elevation={4}
          onClick={enterNewRoom}
        >
          <CardContent>
            <Typography variant="h5" component="div">
              オンライン<wbr />モード
            </Typography>
            <Typography variant="body2">
              <p>みんなで使う</p>
              <p>サーバー上に保存</p>
              <p>24時間有効</p>
            </Typography>
            <Typography align="center" color="primary">
              ENTER
            </Typography>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2>これは？</h2>
        <p>
          地図読みでの利用を目的としたオンラインホワイトボードです．
          画像読み込み，拡大，縮小に加えて1度刻みでの回転にも対応しています．
        </p>
        <p>
          オンラインモードで開始し，遷移後のURLを共有すると他の人といっしょに使えます．
        </p>
        <h2>使い方</h2>
        <p>
          ローカルモードかオンラインモードを選ぶとホワイトボード画面に遷移します．
        </p>
        <p>
          ローカルモードは画像や描画内容をあなたの端末に保持します．
          データは他の人から見られません．
          ブラウザのタブを閉じたり更新したりするとリセットされます．
        </p>
        <p>
          オンラインモードは画像や描画内容をサーバー上に保存します．
          データは同じルームに入った人（URLにアクセスした人）と共有されます．
          ルームが有効な限りデータは保存されているので再読み込みできます．
        </p>
        <h2>操作方法</h2>
        <h3>移動モード</h3>
        <p>
          基本的に地図アプリと同じ操作感です．
          スワイプで移動，2本指で拡大縮小回転です．
          PCならスクロールで拡大縮小，Ctrlキーを押しながらスクロールで回転です．
        </p>
        <h3>ペンモード</h3>
        <p>
          描けます．
          移動はできません．
        </p>
        <h3>消しゴムモード</h3>
        <p>
          消せます．
          移動はできません．
          触れた線1本まるまる消えます．
          つまり部分的には消せません．
        </p>
        <h3>全消し</h3>
        <p>
          描いたものが全部消えます．
          画像は残ります．
        </p>
        <h3>画像選択</h3>
        <p>
          ホワイトボードに読み込む画像を選択します．
          最大20MBまでです．
          画像ファイルのみ受け付けます．
          PDFは読み込めません．
        </p>
        <h2>注意</h2>
        <p>
          無保障です．
          勝手にデータやルームが消えることもあれば規定の時間を超えて残ることもありえます．
          機微なデータは入れないでください．
        </p>
        <h2>つくったひと</h2>
        <Link href="https://twitter.com/tooktwi" underline="hover">@tooktwi</Link> <br />
        意見要望はこちらへ
      </div>
    </div>
  );
}

export { Home };
