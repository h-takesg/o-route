# 引継書（一時ファイル）: ランディングページ刷新

> **一時ファイル**。`docs/landing-page` を `master` にマージする前に削除すること。
> 作成: 2026-11-02 / 前任: Cursor Agent（Claude Opus 5.5 オーケストレータ + Composer 2.5 サブエージェント）

---

## 1. 目的

`/`（ホーム）を、ユーザーに関係する情報だけを適切な分量で載せたランディングページに作り直す。
見出し・アイコン・ボタン・**実際の UI のスクリーンショット**を置き、一部は **WebM 動画**（サムネイル表示 → 再生ボタンで再生）にする。

## 2. ユーザーが決めたこと（変更する場合はユーザーに確認）

| 項目 | 決定 |
|---|---|
| 文面 | 「、。」を使う。装飾的な記述を避ける。暗号化（E2EE）の話は載せない。操作説明は PC を主とし、タッチは補足 |
| 描画の仕組み | `home_ja.md` + `marked-react` を廃止し、React + MUI コンポーネントで構成（実施済み） |
| 開始導線 | ヒーローにボタン + 下にモード比較カード（実施済み） |
| 画像 | 実 UI のスクリーンショット。ヒーロー / 機能別（回転・描画と消しゴム・線の表示）/ 視点共有（2 画面並べ）。スマホ幅の画像は不要 |
| 動画 | **WebM（VP9）**。poster 画像 + 再生ボタンでその場再生。対象はヒーロー・回転・描画と消しゴム・視点共有。線の表示は静止画のまま |
| サンプル地図 | 実在地図は著作権上使えないため架空地図。**作り方は方針変更が必要**（§6） |

### オリエンテーリングの専門要件（ユーザーはオリエンティア。誤りはすぐ指摘される）

- **ISOM 2017-2** の色・寸法に準拠。1:10000 は 1:15000 の寸法 × 1.5
- コースのパープルは、オフセット印刷でない場合は下の地図を透過させる（乗算などで重ね刷りを模す）
- スタートの三角は、頂点を 1 番へのレッグの方向に向ける
- コントロールは **ISCD 2018** の位置説明（D 欄の特徴物、G 欄の位置）で表せる特徴物の上に置き、円の中心をその点に合わせる
- コントロール間の距離は **IOF Foot-O 競技規則 19.4** による。スタートのフラッグを含むすべての組で 30 m 以上。似た特徴物どうしは 60 m 以上
- コントロールコードは 30 より大きい数
- **規則を捏造しない**。前任は「連続するコントロールを同じ特徴物に置かない」という存在しない規則を足して指摘された。ドッグレッグ回避などは「規則」ではなく「コース設定の目安」として扱う
- ルートは湖などの水域を通らない。実際に選びそうなルートにする（レッグの直線をなぞるだけにしない）

## 3. ブランチとコミット

作業ブランチ: **`docs/landing-page`**（`master` から分岐。`master` へのマージはユーザーの承認が必要）

```
fd8637c Screenshot pipeline: JSON-driven routes and WebM demo videos   ← 現在の HEAD（ビルド可）
8f43d67 Add poster + play button demo video component to landing page
def0459 Add Playwright screenshot pipeline for landing page images
1f8efb9 Sample map: ISCD-described control sites, IOF 19.4 spacing, loop course, course JSON export
5894429 Sample map: ISOM 2017-2 colours, 1:10000 symbol sizes, start triangle orientation, multiply overprint
9cf453c Make landing controls table responsive and structure icon descriptions
40610c8 Add deterministic fictional orienteering sample map generator
af7cfdf Rebuild landing page with React/MUI sections
6df75f8 Rewrite landing page copy: cover all features, PC-first controls
```

退避ブランチ: **`wip/landing-capture-fixes`**（`d50ae82`、fd8637c の上の WIP 1 コミット。**撮影が最後まで通っていない**）。中身は §5 の修正の途中実装。使うかどうかは方針次第で、捨ててもよい。

## 4. 完成している部分（そのまま使える）

### ページ（`src/components/home/`）

| ファイル | 内容 |
|---|---|
| `Home.tsx` | 各セクションを組み立てる。`enterNewRoom`（E2EE 鍵生成）のロジックは変更していない |
| `home/HomeHero.tsx` | `<h1>O-Route</h1>`、説明文、ボタン（`enter-local` / `enter-online`）、ヒーロー動画 |
| `home/ModeCards.tsx` | ローカル / オンラインの比較カード（`enter-local-card` / `enter-online-card`） |
| `home/FeatureSection.tsx` | 機能 4 枚。回転・描画と消しゴム・視点共有は `DemoVideo`、線の表示は `FramedScreenshot` |
| `home/ControlsTable.tsx` | 操作方法。md 以上は表、xs/sm は縦積み。ツールバーと同じアイコン |
| `home/HomeFooter.tsx` | 注意・つくったひと |
| `home/DemoVideo.tsx` | poster + 再生ボタン。押すと `<video autoPlay muted playsInline controls>` に差し替え。押すまで動画を読み込まない。testid `demo-play-*` / `demo-video-*` |
| `home/FramedScreenshot.tsx` | 枠付き `<img>` |

- 画像サイズの指定: hero 1440×900、rotate / draw-erase / opacity 1152×864、view-sharing 2312×864
- 確認済み: `npm run build`、ユニット 67 件、E2E 33 件（新規 `e2e/home-demo-video.spec.ts` を含む）

### 撮影の仕組み（`scripts/screenshots/`）

| ファイル | 内容 |
|---|---|
| `generate-sample-map.mjs` | 架空 O-map を SVG で生成し、PNG に変換。`npm run screenshots:map`。決定的（同じ出力） |
| `sample-map.png` / `.svg` / `sample-course.json` | 生成物。JSON にはコースと地物の座標（100 px = 100 m） |
| `playwright.screenshots.config.ts` | 撮影専用の設定。**port 3100** で Emulator + vite を自前起動（`reuseExistingServer: false`） |
| `landing.capture.ts` | 静止画 5 枚 + WebM 4 本を `public/images/home/` に出力。`npm run screenshots`（約 10 分） |
| `capture-utils.ts` | 地図座標→画面座標の変換、表示の設定と検証、ルート描画、WebP 出力 |
| `video-capture.ts` / `demo-scripts.ts` | 1 コマずつ撮影 → Chromium の MediaRecorder で VP9 WebM に変換。カーソルの合成 |
| `routes.ts` / `course-data.ts` | JSON からレッグとルートを作り、検証（端点・湖の回避） |
| `tsconfig.screenshots.json` | 撮影スクリプト用の型チェック（`npm run typecheck:screenshots`）。`tsconfig.json` からは参照しない |

## 5. 未完了・既知の問題（`fd8637c` 時点の出力）

| 対象 | 問題 |
|---|---|
| `draw-erase.webp` | 7→フィニッシュを湖をまっすぐ横切る余計な線が残っている。原因は、ストローク間でペンが上がらず直線でつながったことと推定 |
| `rotate.webm` | 回転していく様子が映らず、途中のコマが最後と同じ。最後のコマがペンモードのまま（移動モードにすべき） |
| 動画全般 | 合成したカーソルが小さく、ページ上（4 割程度に縮小）では見えない |
| `opacity.webp` | 4→5、5→6 のルートが紫のレッグの線をなぞっているだけ |
| ヒーローのレイアウト | PC 幅で 2 列のため画像が小さい。文字の下に全幅で置く案を検討中 |
| サンプル地図 | ユーザー評価は「完成度が高いとは言えない」。等高線が谷の中で途切れる、植生の形が単調など |
| `AGENTS.md` | ランディングページの構成と撮影の仕組みがまだ書かれていない |

## 6. 方針変更が必要な理由（前任の反省）

1. **1 回の試行が長すぎる**。`npm run screenshots` は全部の画像と動画を 1 本のテストで直列に撮るので、約 10 分かかる。1 枚だけ直したくても全部撮り直しになる
2. **地図の手続き生成に時間を使いすぎた**。ノイズ → 座標による設計 → ISOM 色 → ISCD 配置と 8 回以上作り直したが、本物らしさには届いていない
3. **ルートの自動生成も、見た目の破綻が多い**（膨らむ、湖を横切る、レッグをなぞる）。そのたびにアサーションを足す対症療法になり、コードが肥大化した（`capture-utils.ts` は 936 行）

### 次の方針の候補（ユーザーに選んでもらう）

- **地図**
  - (a) ユーザー（オリエンティア）が OpenOrienteering Mapper などで小さな架空地図を描き、PNG を提供する（最も確実）
  - (b) 利用条件が明確な公開サンプル地図を使う（ライセンスを必ず確認）
  - (c) 生成を続けるなら範囲を絞る（例：地図の一部だけを写す構図にする）
- **ルート**
  - 自動生成をやめ、地図ごとに人が決めた折れ線（座標の JSON）を使う。ユーザーにレビューしてもらう
- **撮影**
  - 画像・動画ごとにテストを分け、`--grep` で 1 枚ずつ撮れるようにする
  - 撮影用サーバー（port 3100）は起動したまま使い回せるようにする
  - 目標は 1 枚 1 分以内
- **動画**
  - 必要最小限の本数から始める（例：ヒーローと視点共有だけ）
  - 手で収録する選択肢もユーザーに示す

## 7. 環境と注意

- **npm / node / playwright はすべて Dev Container 内で実行する**:
  `docker exec -u vscode -w /workspaces/tizuyomi great_banzai bash -lc '<cmd>'`
  - Windows ホストで npm を実行しない（native binding が壊れる）
- **ユーザーの dev サーバー（port 3000）は本番 Firebase に接続していることがある**
  - E2E や撮影で再利用しない（本番にテスト用ルームができる）
  - フル E2E は port 3100 の一時設定で回し、終わったら一時設定を消す
  - 撮影中に port 9000 / 9199（Emulator）を止めない
- `"follwer"` の綴りは意図的（DB 互換）。直さない
- `c:\Users\h-takesg\.cursor\plans\e2ee_導入計画_cf59a001.plan.md` は編集しない
- `AGENTS.md` と `.cursor/rules/*.mdc` を先に読む（Immutable.js、Vike、MUI アイコンの `@ts-ignore` パターン、`printWidth: 100`）
- ユーザールール: 主チャットはオーケストレータに徹し、実作業は Composer 2.5 のサブエージェント（implementer / frontend / debugger / test-runner / verifier）に任せる。委譲時は、目的・対象ファイル・制約・完了条件をプロンプトにすべて書く
- 変更後: `npm run format` → `npm run build`。UI を変えたら E2E も実行する。完了報告の前に verifier で独立検証する

## 8. ランディングページ以外の残件（ユーザー側）

- 本番 Storage の CORS を、本番オリジンのみに戻したことの確認
- 本番での手動確認（E2EE 導入後）
- `chore/storage-rules-transition` ブランチの削除（マージしない）
- 別件の候補: Mac のトラックパッドでピンチすると、拡大ではなく回転になる可能性（ブラウザがピンチを `ctrlKey` 付きのホイールとして送るため）。実機未確認
