# AGENTS.md

このファイルは、AI エージェントが本リポジトリを理解・作業するための調査メモです。
内容の正確性は執筆時点の静的解析に基づくため、コード変更後は再確認してください。

---

## 調査メタデータ（信頼度確認用）

| 項目 | 値 |
|------|-----|
| 調査日 | 2026-07-05 |
| 執筆者 | Cursor Agent（Composer） |
| モデル | Composer（Cursor が提供する言語モデル） |
| 調査方法 | リポジトリ全ファイルの静的読解、`npm run verify`（format + unit + e2e + build）の実行確認 |
| 実行確認 | `npm run build` 成功（6 ページ prerender）、`test:unit` 67 件、`test:e2e` 32 件、`eslint src` エラーなし（2026-11-01 時点） |
| 信頼度 | コード構造・依存関係・設計意図・ビルド・E2E（Emulator 経由）は**高**。本番 Firebase 実環境での運用検証は**未実施** |

> 後から信頼度を確認する際は、上記「調査日」「調査方法」と現行コードの差分を照合してください。

---

## プロジェクト概要

**O-Route**（npm パッケージ名: `o-route`、バージョン 2.0.0）は、オリエンテーリングの**地図読み**向けオンラインホワイトボード。AI コーディング普及前（最終コミット 2024-02-11）に書かれた小規模アプリ。

- 地図画像の読み込み、拡大・縮小、回転（1 度刻み）
- 自由描画、消しゴム（線単位）、全消し
- 線の透明度切替（ビューワー単位で全線を transparent / translucent / opaque）
- オンラインモードで URL 共有による共同作業、視点共有（**E2EE**: AES-GCM 256、鍵は URL フラグメント `#k=` のみ）

| 項目 | 値 |
|------|-----|
| 本番 URL | https://o-route.web.app |
| GitHub | https://github.com/h-takesg/o-route |
| 作者（アプリ） | [@tooktwi](https://twitter.com/tooktwi) |
| 総行数 | 約 2,500 行（`src/` 内 TypeScript/TSX） |
| ファイル数 | 50 ファイル（`src/` 内 TS/TSX）+ `e2e/` テスト |

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| UI | React 18, TypeScript 5.1, MUI 5, react-icons | 関数コンポーネントのみ |
| キャンバス | Konva 9, react-konva 18, use-image | `/local` `/online` は dynamic import でクライアント専用。`ssr.external: ["konva", "react-konva"]` |
| ルーティング / SSR | Vike ^0.4.268（`prerender: true`, `clientRouting: true`） | v1 design（`+config.h.ts`）。0.4.260 は Vite `--host`/`--port` を拒否し dev/e2e サーバーが壊れる |
| ビルド | Vite 8 | `ssr.noExternal: ["react-icons"]` |
| 暗号 | Web Crypto (`crypto.subtle`) | `src/crypto/roomCrypto.ts`。secure context（https / localhost）必須 |
| 状態モデル | Immutable.js 4（`Record`, `Map`, `List`） | 直接 mutate 禁止 |
| BaaS | Firebase 11（RTDB, Storage, Hosting） | 認証なし。ローカルは Emulator 対応 |
| 品質 | ESLint 8 + Prettier 3 + Vitest 4 + Playwright 1.49 + typescript-eslint 7 | `npm run verify` で一括検証 |
| 開発環境 | Dev Container（Ubuntu jammy, **Node 24 LTS**, **Java 21**） | Playwright / Firebase Emulator 用 |

---

## ディレクトリ構成

```
/workspaces/tizuyomi/
├── src/
│   ├── pages/              # Vike ファイルベースルーティング
│   │   ├── index/          # ホーム（モード選択）
│   │   ├── local/          # ローカルモード
│   │   ├── online/         # オンラインモード（roomId + `#k=` 鍵）
│   │   ├── errors/room_not_found/
│   │   ├── errors/invalid_room_key/
│   │   └── _error/         # 404/500
│   ├── components/         # UI・キャンバス
│   ├── crypto/             # roomCrypto（E2EE）
│   ├── models/             # ViewModel, DrawLine, Lines, ChunkAssembler
│   ├── hooks/              # useDatabaseRef, useWindowSize, useOnlineLines 等
│   ├── renderer/           # SSR / クライアントハイドレーション
│   ├── components/home/    # ランディング（Hero, ModeCards, FeatureSection 等）
│   ├── firebase.ts         # Firebase 初期化（Emulator 接続含む）
│   ├── math.ts             # Vector, 線分交差判定
│   └── types.ts            # Mode, ViewMode, LineOpacity
├── e2e/                    # Playwright E2E（home, local, online, sync, room-key, image/view E2EE）
├── storage.cors.json       # 本番 Storage CORS（`getBytes` 用・手動適用）
├── playwright.config.ts    # E2E 設定（dev サーバー再利用 or e2e:server）
├── vitest.config.ts
├── tsconfig.e2e.json       # e2e / playwright 用（composite: true, noEmit: false）
├── .prettierrc.json        # Prettier 設定（printWidth: 100）
├── database.rules.json     # RTDB セキュリティルール
├── storage.rules           # Storage セキュリティルール
├── firebase.json           # Hosting / DB / Storage 設定
├── vite.config.ts
├── tsconfig.json           # strict: true
├── .eslintrc.yml
├── .devcontainer/devcontainer.json
└── dist/                   # ビルド成果物（client + server）
```

---

## ファイル責務マップ

エージェントが変更対象を特定するための索引。行数は調査時点の概算。

| ファイル | 行数 | 責務 | 変更時の注意 |
|---------|------|------|-------------|
| `Canvas.tsx` | 130 | Konva Stage、線の透明度適用（描画 JSX） | Local/Online 共通。`data-testid="canvas-stage"`。線は `Group` で束ね、半透明時は `cache()` して均一な透明度に |
| `hooks/useCanvasGestures.ts` | 250 | パン/ズーム/回転、描画/消去イベント、慣性スクロール | `Canvas.tsx` から抽出。アンマウント時に momentum を停止 |
| `OnlineCanvas.tsx` | 65 | オンライン画面の薄いラッパー。フックを束ねて Canvas に渡す | 同期ロジックは hooks 側。アップロードエラーは UI 層で表示 |
| `hooks/useOnlineLines.ts` | 285 | Firebase 線の E2EE 送受信・chunk 同期 | `enqueueLineWrite` キュー・`ChunkAssembler`・effect deps `[linesRef]` を安易に変えない |
| `hooks/useOnlineRoomImage.ts` | 180 | 暗号化画像 meta / Storage 取得 | `e2ee/check` 検証。`getBytes` + decrypt → blob URL。20MB − 28 バイト上限 |
| `hooks/useViewSharing.ts` | 250 | 視点共有（leader/follwer）、30fps | リーダー tick は `payload` のみ `update`。claim は `{ id }` を先に `set` |
| `crypto/roomCrypto.ts` | 325 | AES-GCM 256、envelope、AAD、鍵 import/export | 平文座標・view・画像を Firebase に書かない |
| `models/ChunkAssembler.ts` | 35 | 受信 chunk の連番組み立て | 非連続 index は保留。重複 `onChildAdded` を無視 |
| `LocalCanvas.tsx` | 80 | ローカル state のみ。`URL.createObjectURL` で画像 | OnlineCanvas の簡易版 |
| `ViewModel.ts` | 47 | 位置・スケール・回転の Immutable Record | ユニットテストあり |
| `LineModel.ts` | 112 | DrawLine / Lines。消しゴムの交差判定 | ユニットテストあり |
| `math.ts` | 89 | Vector クラス、線分交差、clamp | ユニットテストあり |
| `Home.tsx` | 160 | モード選択、E2EE ルーム作成（鍵生成 + `#k=` 遷移） | `crypto.subtle` 無し（LAN http 等）で alert。`data-testid="enter-local"` / `enter-online` |
| `BasicControl.tsx` | 146 | ツールバー（移動/ペン/消しゴム/全消し/画像） | `data-testid="mode-*"`, `clear-all`, `load-image` |
| `ViewSharingControl.tsx` | 55 | 視点共有モード切替（オンラインのみ） | `"follwer"` typo に注意。`view-single` / `view-leader` / `view-follwer` |
| `LineOpacityControl.tsx` | 55 | 線の透明度切替（Local/Online 両方） | 値は `transparent`/`translucent`/`opaque` の semantic 3 段階。id/UI に数値は含めない |
| `hooks/useDatabaseRef.ts` | 13 | Firebase ref を useState で 1 回生成 | path は roomId 依存で不変想定 |
| `hooks/useWindowSize.ts` | 18 | window resize リスナー | |
| `pages/local/+Page.tsx` | 19 | `LocalCanvas` を dynamic import | SSR では `null` |
| `pages/online/+Page.tsx` | 47 | `roomId` + hash `#k=` から鍵 import、`OnlineCanvas` | 鍵欠落・不正 → `invalid_room_key`。`roomId` なし → `room_not_found` |
| `components/InvalidRoomKey.tsx` | 20 | 無効鍵エラー UI | `data-testid="invalid-room-key"` |
| `components/RoomNotFound.tsx` | 20 | ルーム不在・期限切れ | |

---

## ルーティング

| パス | コンポーネント | 説明 |
|------|---------------|------|
| `/` | `Home` | ローカル / オンライン選択 |
| `/local` | `LocalCanvas` | 端末内のみ。タブ閉じで消える |
| `/online?roomId=xxx#k=…` | `OnlineCanvas` | E2EE Firebase ルーム。24 時間有効。鍵は fragment のみ |
| `/errors/room_not_found` | `RoomNotFound` | 無効 roomId・期限切れ |
| `/errors/invalid_room_key` | `InvalidRoomKey` | 鍵欠落・形式不正・check 不一致 |
| `/_error` | 404/500 | Vike エラーページ |

Vike 設定（`src/renderer/+config.h.ts`）:
- `clientRouting: true` — SPA 的なクライアント遷移
- `hydrationCanBeAborted: true`

---

## アーキテクチャ

```
Home (/)
  ├─→ LocalCanvas (/local)  ─→ Canvas (Konva)
  │       └─ React state (Lines, ViewModel, imageUrl)
  │
  └─→ OnlineCanvas (/online) ─→ Canvas (Konva)
          ├─ useOnlineLines / useOnlineRoomImage / useViewSharing
          ├─ roomKey from URL hash `#k=` (never Firebase)
          ├─ Firebase RTDB (encrypted lines, view payload, image meta, e2ee check)
          └─ Firebase Storage (暗号化画像バイナリ)
```

### コンポーネント階層

```
PageShell (StrictMode)
  └─ Page (+Page.tsx)
       ├─ Home
       ├─ LocalCanvas / OnlineCanvas
       │    ├─ Canvas (Konva Stage > Layer > Group)  … data-testid="canvas-stage"
       │    │    ├─ Rect (背景 80000px)
       │    │    ├─ MapImage (use-image)
       │    │    └─ Group (opacity, 半透明時 cache) > Line[] (描画線)
       │    └─ Overlay
       │         ├─ BasicControl       … data-testid="mode-*"
       │         ├─ LineOpacityControl … data-testid="opacity-*"
       │         └─ ViewSharingControl (Online のみ)
       └─ RoomNotFound / InvalidRoomKey
```

### データモデル（Firebase Realtime Database）

オンラインルームは**暗号化のみ**（平文座標・平文 view・公開 Storage URL は廃止）。

```
rooms/{roomId}/
  ├── timestamp      # ルーム作成時刻（24h TTL の基準・平文）
  ├── e2ee           # { v: 1, check: envelope("o-route-e2ee-v1", purpose "check") }
  ├── image          # "" | envelope(JSON { path, type }, purpose "image-meta")
  ├── lines/{lineId}/
  │     ├── isDrawing, timestamp   # 平文メタデータ
  │     └── chunks/{n}             # envelope(Float64 LE [x,y], purpose "line/{lineId}/{n}")
  └── view/
        ├── id       # リーダー UUID（平文・競合解決）
        └── payload  # envelope(JSON { center, area, rotation }, purpose "view/{id}")
```

**Storage**: `{roomId}/{Date.now()}` に `iv(12)||ciphertext+tag`（`contentType: application/octet-stream`、最大 20MB）。RTDB の `image` は暗号化メタのみ。

**Envelope（RTDB 文字列）**: `1.<iv base64url>.<ct base64url>`。**AAD**: `o-route/v1/{roomId}/{purpose}`。**オーバーヘッド**: 28 バイト（`ENCRYPTION_OVERHEAD_BYTES`）。

**漏れるメタデータ**（暗号化されない）: 線の本数、chunk 数（≒ 点数）、書き込みタイミング、画像サイズ、`isDrawing`、タイムスタンプ、リーダー `id`、`roomId`。サーバーは削除・リプレイ可能だが、鍵なしでは復号・改ざん不可。

**鍵**: ルーム作成時に `Home.tsx` で生成。共有は URL 全体（`#k=` 含む）。HTTP リクエストや Referer に fragment は載らない。

### 描画・操作（Canvas 定数）

| 定数 | 値 | 場所 |
|------|-----|------|
| SCALE_MIN / MAX | 0.1 / 5 | `Canvas.tsx` |
| BACKGROUND_SIZE | 80000px | `Canvas.tsx` |
| 線色 / 太さ | red / 8 | `Canvas.tsx` |
| LINE_OPACITY_VALUES | transparent 0 / translucent 0.5 / opaque 1 | `Canvas.tsx`（中間値はここだけで管理） |
| VIEW_SYNC_FPS | 30 | `hooks/useViewSharing.ts` |

### 線の透明度（Local/Online 両方・ビューワー単位）

| モード | 動作 |
|--------|------|
| `opaque` | 通常表示（初期値）。キャッシュなし |
| `translucent` | 線 `Group` を `cache()` で平坦化してから不透明度 0.5。重なりが濃くならず均一 |
| `transparent` | 不透明度 0。全線が非表示 |

- 状態は各ビューワーの React state（`useState<LineOpacity>`）で、**Firebase には同期しない**（他ユーザーに影響しない）
- Konva は `Group`/`Layer` の `opacity` を子要素ごとに適用するため、キャッシュしないと半透明の線の重なりが濃くなる。`Canvas.tsx` の `useEffect([lines, lineOpacity])` で `translucent` 時のみ `cache()`
- 中間段階の具体値（0.5）は `LINE_OPACITY_VALUES` の 1 箇所のみ。id/UI には数値を出さない

### 視点共有（オンラインのみ）

| モード | 動作 |
|--------|------|
| `single` | 各自独立。view リスナー解除 |
| `leader` | 30fps で `view/payload` のみ `update`（`id` は claim 時に一度 `set`） |
| `follwer` | 最新 snapshot の `payload` を復号して追従（**typo**: follower の意）。欠落・復号失敗は無視 |

リーダーが複数いる場合、後から leader になった人の `id` が優先され、先着は follower に降格する。

---

## コード規約・パターン

エージェントが既存コードに合わせるためのルール。

### TypeScript / React

- **関数コンポーネント**のみ（`function Foo()` 形式）。`react/function-component-definition` が ESLint で強制
- **named export** のみ（`export { Foo }`）。`import/no-default-export` 例外は Vike 設定ファイルのみ
- **strict mode** 有効。`any` 禁止
- Props は同一ファイル内で `type Props = { ... }` と定義
- インライン style と MUI `sx` が混在。キャンバス画面は `Overlay` + MUI ToggleButton、ホームは MUI Card

### Immutable.js

- 状態更新は常に `.set()` / `.setIn()` で新インスタンスを返す
- `ViewModel`, `DrawLine`, `Lines` はすべて `Record` サブクラス
- ローカルモードの線キーは連番文字列（`"0"`, `"1"`, ...）
- オンラインモードの線キーは Firebase `push()` キー

### Firebase

- DB ref は `useDatabaseRef` で生成（マウント時 1 回）
- ルーム作成: `push` + `set` with `{ image: "", lines: {}, timestamp, e2ee: { v: 1, check } }` + navigate with `#k=`
- 描画中の線: `chunks/{n}` に envelope で座標ペアを `update`（`points` フィールドは廃止）
- 画像: Storage に暗号化バイナリ `uploadBytes` → RTDB `image` に暗号化メタ JSON envelope

### Vike / SSR

- ページは `src/pages/<route>/+Page.tsx` に `export { Page }` + `function Page()`
- `/local` `/online` は `useEffect` 内 dynamic import で Konva コンポーネントを読み込む（SSR では `null`）
- `vite.config.ts` で `ssr.external: ["konva", "react-konva"]`。npm `canvas` パッケージは不使用
- クライアント専用 API（`window`, Firebase listener）は `useEffect` 内か CSR 前提のページで使用
- `react-icons` は SSR でバンドルに含める必要あり（`vite.config.ts` の `ssr.noExternal`）
- オンライン専用 `+onRenderHtml.tsx` は廃止。メタ情報は `src/renderer/+onRenderHtml.tsx` に統一
- `+onRenderClient.tsx` は `loading...` プレースホルダ検出時 `createRoot` にフォールバック

---

## 主要データフロー

### ローカル描画

```
pointerDown/move (mode=draw)
  → Canvas.addPointToDrawingLine
  → LocalCanvas: Lines.addPoint / addLine
  → React setState
  → Canvas re-render (Konva Line)
```

### オンライン描画（送信側）

```
pointerMove (mode=draw)
  → OnlineCanvas.addPointToDrawingLine
  ├─ local: setLines (即時反映)
  └─ remote: enqueueLineWrite → set line + update chunks/{n} (encrypted)
       初期 set を await 後、chunk update は順序付きで非 await
       isDrawing:false は同一キューで最後に発行
```

### オンライン描画（受信側）

```
onChildAdded(lines/{id})
  → isDrawing / timestamp 監視 + onChildAdded(chunks/{n})
  → decrypt → ChunkAssembler.offer → Lines.appendValues
onChildRemoved(lines/{id})
  → Lines.removeLine（appendValues は削除済み線を no-op）
```

### オンライン画像

```
upload: encryptBinary → Storage (octet-stream) → encryptJson meta → RTDB image
download: get image meta → decrypt → getBytes(roomId/...) → decryptBinary → blob: URL
  （同一オリジンの blob のため CORS 汚染なし。本番 Storage は CORS 設定が必要）
```

### 消しゴム

```
pointerMove (mode=erase)
  → Lines.getCrossingLine(beforePoint, currentPoint)
  → math.intersectsLineSegment で線分交差判定
  → 交差した線 ID 全体を削除（部分消し不可）
```

---

## 開発コマンド

```bash
npm run dev      # vite --host（WSL/Dev Container 向けに usePolling 有効）
npm run build    # tsc && vite build（prerender 含む）
npm run preview  # vite preview --host
npm run format   # eslint src --fix && prettier --write src
npm run test:unit   # Vitest（math, ViewModel, LineModel, roomCrypto, ChunkAssembler）
npm run test:e2e    # Playwright（UI + 操作 + Emulator 連携）
npm run verify      # format + unit + e2e + build（エージェント向け一括検証）
```

| コマンド | 確認結果（2026-11-01） |
|---------|----------------------|
| `npm run build` | 成功。6 HTML ページ prerender |
| `npm run test:unit` | 67 テスト通過（5 ファイル） |
| `npm run test:e2e` | 32 テスト（Playwright + Emulator。要 Java 21・Chromium） |
| `eslint src` | エラーなし |

デプロイ先: Firebase Hosting（`dist/client`）。`firebase.json` で Cache-Control: no-cache。

---

## セキュリティ・運用

- **認証なし**。roomId を知る人が RTDB/Storage に読み書き可能（中身は E2EE のため平文は読めない）
- **E2EE**: AES-GCM 256。ルーム鍵は URL fragment `#k=` のみ（Firebase 非送信）。鍵共有 = URL 共有
- **secure context**: `crypto.subtle` が必要（https または localhost）。LAN の http ではオンラインルーム作成不可（alert）
- DB ルール: `rooms` への write は誰でも可。各 room は `timestamp + 24h` まで read/write
- Storage: read 全公開。write は 20MB 未満かつ `contentType == application/octet-stream` のみ
- **本番 Storage CORS**（未適用の場合 `getBytes` 失敗）: リポジトリ `storage.cors.json` をバケットに設定

```bash
gsutil cors set storage.cors.json gs://o-route.appspot.com
# または
gcloud storage buckets update gs://o-route.appspot.com --cors-file=storage.cors.json
firebase deploy --only storage,hosting
```

Emulator では CORS 不要（E2E で確認済み）。

- Firebase 設定（apiKey 等）は `src/firebase.ts` に直書き（クライアントアプリとして一般的）
- 機微データの投入は想定外（ホームの注意欄にも同旨）。E2EE でもメタデータは漏れる

---

## 既知の課題・技術的負債

調査時点で確認した事項。修正済みかは都度確認すること。

### タイポ・命名

| 項目 | 箇所 | 影響 |
|------|------|------|
| `"follwer"` | `types.ts`, `ViewSharingControl.tsx`, `OnlineCanvas.tsx` | DB 値・UI 値に波及。修正時は後方互換を考慮 |

### 潜在的バグ

（2026-07-06 リファクタで修正済み: `useOnlineLines` 自分の線判定、`useViewSharing` リスナーリーク、`pages/online` のリダイレクト）

（2026-11-01 E2EE で修正済み: 後参加時の線 duplicate points、`follwer` 選択時の NaN view）

### インフラ・ツール

| 項目 | 内容 |
|------|------|
| テスト | ユニット 67 件（Vitest: math, ViewModel, LineModel, roomCrypto, ChunkAssembler）+ E2E 32 件（home, local-canvas, online-room, online-sync, room-key, image-e2ee, view-e2ee） |
| 本番 CORS | `storage.cors.json` + `gsutil`/`gcloud` で手動適用（コードデプロイだけでは不十分） |
| Dev Container | **npm / test はコンテナ内で実行**。Windows ホストで `npm install` すると Linux 向け native binding（rolldown 等）が壊れ `vite` 失敗 → コンテナ内で `npm install` |
| Vike | `^0.4.268`（0.4.260 は `--host`/`--port` 非対応で `npm run dev` / `e2e:server` 破損） |
| Prettier | `.prettierrc.json` は `printWidth: 100`（空だと不正 JSON で `npm run format` が失敗。MUI アイコンの `@ts-ignore` 回避コードが折り返されないよう 100 が必要） |
| tsconfig | `tsconfig.e2e.json` は `composite: true` かつ `noEmit: false`（親の `noEmit: true` を継承すると TS6310 で `tsc` が失敗）。`.gitignore` に `*.tsbuildinfo` |
| 依存 | `canvas` npm パッケージは削除済み（Konva ページはクライアント専用） |
| Node | Dev Container を Node 24 LTS に更新済み。再ビルド後に `node -v` で確認 |
| CI | 意図的に未導入（スキップ） |
| `.cursor/rules` | 6 ファイル（E2E 検証手順含む） |
| 最終更新 | 2024-02-11（git log） |

### 複雑度ホットスポット

1. **`hooks/useOnlineLines.ts`** — E2EE chunk 送受信・`enqueueLineWrite` キュー・`ChunkAssembler`・async decrypt の `cancelled` ガード。effect deps は `[linesRef]` のまま維持
2. **`hooks/useViewSharing.ts`** — リーダー claim（`id` 先書き）・payload-only tick・フォロワー最新 snapshot のみ適用
3. **`hooks/useOnlineRoomImage.ts`** — check 検証・Storage `getBytes`・blob URL ライフサイクル
4. **`crypto/roomCrypto.ts`** — envelope / AAD / purpose 文字列の一貫性
5. **`hooks/useCanvasGestures.ts`** — マウス/タッチ/ホイール/慣性の入力処理

---

## AI コーディングレディ評価

本リポジトリを AI エージェントが安全に改修するための現状評価と推奨事項。

### 現状の強み（AI にとって扱いやすい点）

| 観点 | 評価 |
|------|------|
| 規模 | 約 2,500 行・50 ファイルと小さく、全体把握が容易 |
| 型安全性 | `strict: true`、主要ドメインに型定義あり |
| 責務分離 | `Canvas`（描画）と `Local/OnlineCanvas`（状態管理）が分離。オンライン同期は hooks に抽出済み |
| ドメインモデル | `ViewModel` / `Lines` が Immutable Record で明示的 |
| テスト | ユニット 67 + E2E 32。`npm run verify` でエージェント自律検証可能 |
| リンター | ESLint 設定が厳しめで、AI 生成コードの品質ガードになる |
| このファイル | プロジェクト概要・構成が文書化済み |

### 現状の弱み（AI がハマりやすい点）

| 観点 | リスク |
|------|--------|
| `useOnlineLines` の複雑さ | 暗号化 chunk・書き込みキュー・Assembler・effect 依存配列が難解 |
| typo の存在 | `"follwer"` 等、AI が「修正すべき」と誤判断し DB 互換を壊す可能性 |
| Immutable.js | 現行 React コードベースでは珍しく、AI が通常の object 操作を生成しがち |
| Vike v1 design | フレームワーク固有のファイル命名（`+Page.tsx`, `+config.h.ts`）を AI が知らない場合がある |
| Konva のクライアント専用化 | `/local` `/online` は dynamic import。SSR テストや E2E ではハイドレーション待ちが必要 |
| Konva の opacity 合成 | `Group`/`Layer` の `opacity` は子要素ごとに適用され、重なりが濃くなる。均一な透明度には `cache()` での平坦化が必要（線の透明度機能で対応済み） |

### 推奨改善（優先度順）

AI コーディング環境を整えるための具体的な次ステップ。実施は別タスクとする。

| 優先度 | 施策 | 効果 |
|--------|------|------|
| 高 | `roomCrypto.ts` / `ChunkAssembler.ts` ユニットテスト | 済（67 テスト中） |
| 高 | `math.ts` / `ViewModel.ts` / `LineModel.ts` にユニットテスト追加 | 済 |
| 済 | Playwright E2E + `npm run verify` | UI/操作/オンライン（Emulator）をエージェント自律検証可能に |
| 済 | `OnlineCanvas.tsx` の同期ロジックをカスタムフックへ抽出 | `useOnlineRoomImage` / `useOnlineLines` / `useViewSharing` |
| 済 | Firebase Emulator Suite の導入 | RTDB/Storage エミュレータ + `firebase-tools` |
| 中 | `.cursor/rules/` にプロジェクト規約を追加（Immutable パターン、Vike 規則、typo 注意） | 済 |
| 済 | Node 24 LTS への Dev Container 更新 | `devcontainer.json` で `version: "24"` を指定済み |
| 済 | `useWindwosSize` → `useWindowSize` リネーム | `refactor/rename-use-window-size` で対応 |
| 低 | `"follwer"` → `"follower"` 修正 | DB 既存データとの互換が必要（両方受け入れ期間を設ける） |
| 済 | `canvas` 依存の削除 | Konva を `ssr.external` + ページ dynamic import で対応 |
| — | CI（lint + build + test）の追加 | スキップ（手動で `npm run verify` を確認） |
| 済 | Vite 8 / Vitest 4 化 | Vite 8 + Vitest 4 + Firebase 11 に更新済み |
| 済 | オンライン E2EE | `roomCrypto`、chunk 線、暗号化 view/image、鍵は URL fragment |
| 中 | 本番 Storage CORS 適用 | `storage.cors.json` 作成済み。バケットへの手動適用が残タスク |

---

## エージェント向け作業指針

### 変更前に読むべきファイル

| タスク | 必読ファイル |
|------|-------------|
| キャンバス操作（ズーム/回転/描画） | `Canvas.tsx`, `ViewModel.ts`, `math.ts` |
| ローカルモード | `LocalCanvas.tsx`, `LineModel.ts` |
| オンライン同期 / E2EE | `crypto/roomCrypto.ts`, `hooks/useOnlineLines.ts`, `hooks/useOnlineRoomImage.ts`, `hooks/useViewSharing.ts`, `models/ChunkAssembler.ts`, `OnlineCanvas.tsx`, `database.rules.json`, `storage.rules`, `firebase.ts` |
| 視点共有 | `hooks/useViewSharing.ts`, `ViewSharingControl.tsx` |
| UI ツールバー | `BasicControl.tsx`, `Overlay.tsx` |
| 線の透明度 | `LineOpacityControl.tsx`, `Canvas.tsx`（`LINE_OPACITY_VALUES` と `cache()` 処理）, `types.ts` |
| E2E テスト | `e2e/helpers.ts`, `playwright.config.ts`, `.cursor/rules/e2e-verification.mdc` |
| 新ページ追加 | `src/pages/<route>/+Page.tsx`, `src/renderer/+config.h.ts` |
| SSR / メタ情報 | `src/renderer/+onRenderHtml.tsx` |

### 安全な変更パターン

1. **キャンバス変更** → `Canvas.tsx` と `ViewModel.ts` をセットで確認。Local / Online 両方に影響
2. **同期ロジック変更** → 上記 hooks + `roomCrypto.ts` + `database.rules.json` + `storage.rules` をセットで確認。平文 `points` / 平文 view を復活させない
3. **新ページ追加** → Vike の `src/pages/` 配下に `+Page.tsx` を追加
4. **UI 変更** → MUI + 既存 `Overlay` / `ToggleButton` パターンに合わせる
5. **状態モデル** → Immutable.js の `Record` パターンを維持（直接 mutate しない）
6. **ビルド確認** → 変更後は `npm run verify` または `npm run build` + `npm run test:e2e`（UI 変更時）

### 避けるべきこと

- `Lines` / `ViewModel` の内部フィールドを直接書き換えない
- `"follwer"` を無断で `"follower"` に変更しない（既存ルームデータ・UI 状態に影響）
- ルーム鍵を Firebase に書き込まない（fragment `#k=` のみ）
- `useViewSharing` のリーダー tick で `view/id` を `update` しない（payload のみ）
- `OnlineCanvas` / `useOnlineLines` の `useEffect` 依存配列を安易に変更しない（`useOnlineLines` は `[linesRef]`）
- `Canvas.tsx` の透明度キャッシュ `useEffect([lines, lineOpacity])` を消さない（`translucent` の均一表示が壊れる）。`printWidth` を下げると MUI アイコンの `@ts-ignore` がずれてビルドが壊れる
- Firebase ルールを緩めない（認証なし設計のまま公開運用されている）
- 不要な抽象化レイヤーを追加しない（現状 ~2,500 行規模に対して過剰設計になりやすい）

### E2E 用 `data-testid`

| ID | 要素 |
|----|------|
| `enter-local` / `enter-online` | ホームのモード選択カード |
| `mode-move` / `mode-draw` / `mode-erase` | ツールバーのモード切替 |
| `clear-all` / `load-image` | 全消し・画像読み込み |
| `opacity-opaque` / `opacity-translucent` / `opacity-transparent` | 線の透明度切替 |
| `view-single` / `view-leader` / `view-follwer` | 視点共有モード（`follwer` typo 意図的） |
| `invalid-room-key` | 無効鍵エラーページ |
| `canvas-stage` | Konva Stage のラッパー |

オンライン E2E のルーム作成は Emulator REST API（`e2e/helpers.ts` の `createOnlineRoom` + `roomUrl`、namespace `o-route-default-rtdb`）。DB スナップショット検証は helpers 内で `roomCrypto` 復号。

### 変更後の確認手順

```bash
npm run format      # lint + format
npm run test:unit   # ユニットテスト
npm run test:e2e    # UI / 操作 / オンライン（Emulator 自動起動）
npm run build       # 型チェック + ビルド + prerender
# または一括:
npm run verify
```

E2E 初回セットアップ（Dev Container 再ビルド後は不要）:

```bash
npm run test:e2e:install
sudo env "PATH=$PATH" npx playwright install-deps chromium
```

失敗時は `playwright-report/index.html` と `test-results/` を確認。

オンライン機能の確認には Firebase 実プロジェクトまたは Emulator が必要。

### Firebase Emulator（ローカル開発）

**前提**: JDK **21 以上**（RTDB Emulator 用）。Dev Container では `devcontainer.json` に Java 21 feature を指定済み。

```bash
# エミュレータ + dev サーバーをまとめて起動（DB/Storage は Emulator 向き）
npm run dev:emulator

# 別ターミナルで使う場合
npm run emulators
# 別途 .env.development.local に VITE_USE_FIREBASE_EMULATOR=true を設定して npm run dev
```

- Emulator UI: http://127.0.0.1:4000
- RTDB: port 9000 / Storage: port 9199（`firebase.json` で定義）
- CLI: `firebase-tools`（devDependencies）
- `npm run dev` のみでは **本番 Firebase** に接続。Emulator 向きは上記コマンドか環境変数が必要

**トラブルシュート**: ブラウザで `127.0.0.1:9000` への `ERR_CONNECTION_REFUSED` が出る場合、アプリは Emulator 向きだが **RTDB Emulator が起動していない**（または Dev Container の port 9000 がホストに転送されていない）。`npm run dev:emulator` を使うか、別ターミナルで `npm run emulators` を先に起動する。

**Dev Container / node_modules**: ホスト Windows で `npm install` すると bind mount 経由で Linux 向け native モジュールが上書きされ、コンテナ内の `vite` / `rolldown` が失敗することがある。復旧はコンテナ内で `npm install`（必要なら `npx playwright install chromium`）。

**Vike**: `0.4.260` では Vite CLI の `--host` / `--port` が拒否され `npm run dev` と `npm run e2e:server` が起動しない。`package.json` は `^0.4.268`。

---

## 更新履歴

| 日付 | 執筆者 | モデル | 内容 |
|------|--------|--------|------|
| 2026-07-05 | Cursor Agent（Composer） | Composer | 初版。リポジトリ全体の静的調査を反映 |
| 2026-07-05 | Cursor Agent（Composer） | Composer | Dev Container を Node 24 LTS に更新 |
| 2026-07-05 | Cursor Agent（Composer） | Composer | Vitest ユニットテスト、Firebase Emulator、OnlineCanvas フック分割、canvas 削除、Playwright E2E、`npm run verify` を反映 |
| 2026-07-05 | Cursor Agent（Claude Opus 4.8） | Claude Opus 4.8 | 線の透明度切替機能（`LineOpacityControl` + `Canvas` の `cache()` 均一化）、`.prettierrc.json`（printWidth 100）と `tsconfig.e2e.json`（noEmit false）の設定修正、E2E 11 件に増加を反映 |
| 2026-07-06 | Cursor Agent | Auto | リファクタ計画実施: `useOnlineLines` バグ修正・unsubscribe 化、`useViewSharing` cleanup、`useCanvasGestures` 抽出、技術スタック表更新（Vite 8 / Vitest 4 / Firebase 11） |
| 2026-11-01 | Cursor Agent | Claude Opus 5.5 (orchestrator) + Composer 2.5 (subagents) | オンライン E2EE（AES-GCM 256、鍵は URL `#k=`、chunk 線・暗号化 view/image）、`invalid_room_key` ページ、Storage CORS 手順、`storage.cors.json`、ユニット 67 / E2E 32、Vike 0.4.268、Dev Container 運用注意 |
