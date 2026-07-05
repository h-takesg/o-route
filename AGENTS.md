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
| 実行確認 | `npm run build` 成功（5 ページ prerender）、`test:unit` 35 件、`test:e2e` 10 件、`eslint src` エラーなし |
| 信頼度 | コード構造・依存関係・設計意図・ビルド・E2E（Emulator 経由）は**高**。本番 Firebase 実環境での運用検証は**未実施** |

> 後から信頼度を確認する際は、上記「調査日」「調査方法」と現行コードの差分を照合してください。

---

## プロジェクト概要

**O-Route**（npm パッケージ名: `o-route`、バージョン 2.0.0）は、オリエンテーリングの**地図読み**向けオンラインホワイトボード。AI コーディング普及前（最終コミット 2024-02-11）に書かれた小規模アプリ。

- 地図画像の読み込み、拡大・縮小、回転（1 度刻み）
- 自由描画、消しゴム（線単位）、全消し
- オンラインモードで URL 共有による共同作業、視点共有

| 項目 | 値 |
|------|-----|
| 本番 URL | https://o-route.web.app |
| GitHub | https://github.com/h-takesg/o-route |
| 作者（アプリ） | [@tooktwi](https://twitter.com/tooktwi) |
| 総行数 | 約 2,000 行（`src/` 内 TypeScript/TSX） |
| ファイル数 | 33 ファイル（`src/` 内）+ `e2e/` テスト |

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| UI | React 18, TypeScript 5.1, MUI 5, react-icons | 関数コンポーネントのみ |
| キャンバス | Konva 9, react-konva 18, use-image | `/local` `/online` は dynamic import でクライアント専用。`ssr.external: ["konva", "react-konva"]` |
| ルーティング / SSR | Vike 0.4（`prerender: true`, `clientRouting: true`） | v1 design（`+config.h.ts`） |
| ビルド | Vite 4 | `ssr.noExternal: ["react-icons"]` |
| 状態モデル | Immutable.js 4（`Record`, `Map`, `List`） | 直接 mutate 禁止 |
| BaaS | Firebase 10（RTDB, Storage, Hosting） | 認証なし。ローカルは Emulator 対応 |
| 品質 | ESLint 8 + Prettier 3 + Vitest 1.6 + Playwright 1.49 | `npm run verify` で一括検証 |
| 開発環境 | Dev Container（Ubuntu jammy, **Node 24 LTS**, **Java 21**） | Playwright / Firebase Emulator 用 |

---

## ディレクトリ構成

```
/workspaces/tizuyomi/
├── src/
│   ├── pages/              # Vike ファイルベースルーティング
│   │   ├── index/          # ホーム（モード選択）
│   │   ├── local/          # ローカルモード
│   │   ├── online/         # オンラインモード
│   │   ├── errors/room_not_found/
│   │   └── _error/         # 404/500
│   ├── components/         # UI・キャンバス（9 ファイル）
│   ├── models/             # ViewModel, DrawLine, Lines
│   ├── hooks/              # useDatabaseRef, useWindowSize, useOnlineLines 等
│   ├── renderer/           # SSR / クライアントハイドレーション
│   ├── documents/          # home_ja.md（ホーム画面 Markdown）
│   ├── firebase.ts         # Firebase 初期化（Emulator 接続含む）
│   ├── math.ts             # Vector, 線分交差判定
│   └── types.ts            # Mode, ViewMode
├── e2e/                    # Playwright E2E（home / local / online）
├── playwright.config.ts    # E2E 設定（dev サーバー再利用 or e2e:server）
├── vitest.config.ts
├── tsconfig.e2e.json       # e2e / playwright の ESLint 用
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
| `Canvas.tsx` | 319 | Konva Stage、パン/ズーム/回転、描画/消去イベント、慣性スクロール | Local/Online 共通。`data-testid="canvas-stage"` |
| `OnlineCanvas.tsx` | 69 | オンライン画面の薄いラッパー。フックを束ねて Canvas に渡す | 同期ロジックは hooks 側 |
| `hooks/useOnlineLines.ts` | 155 | Firebase 線の送受信・増分同期 | **複雑度の中心**。useEffect 多数 |
| `hooks/useOnlineRoomImage.ts` | 46 | 画像 URL 同期・Storage アップロード | `get()` 失敗時 room_not_found へ |
| `hooks/useViewSharing.ts` | 131 | 視点共有（leader/follwer）、30fps 書き込み | `VIEW_SYNC_FPS = 30` |
| `LocalCanvas.tsx` | 79 | ローカル state のみ。`URL.createObjectURL` で画像 | OnlineCanvas の簡易版 |
| `ViewModel.ts` | 47 | 位置・スケール・回転の Immutable Record | ユニットテストあり |
| `LineModel.ts` | 112 | DrawLine / Lines。消しゴムの交差判定 | ユニットテストあり |
| `math.ts` | 89 | Vector クラス、線分交差、clamp | ユニットテストあり |
| `Home.tsx` | 113 | モード選択、ルーム作成（`push` + `navigate`） | `data-testid="enter-local"` / `enter-online` |
| `BasicControl.tsx` | 146 | ツールバー（移動/ペン/消しゴム/全消し/画像） | `data-testid="mode-*"`, `clear-all`, `load-image` |
| `ViewSharingControl.tsx` | 52 | 視点共有モード切替（オンラインのみ） | `"follwer"` typo に注意 |
| `hooks/useDatabaseRef.ts` | 13 | Firebase ref を useState で 1 回生成 | path は roomId 依存で不変想定 |
| `hooks/useWindowSize.ts` | 18 | window resize リスナー | |
| `pages/local/+Page.tsx` | 19 | `LocalCanvas` を dynamic import | SSR では `null` |
| `pages/online/+Page.tsx` | 24 | `roomId` 取得後 `OnlineCanvas` を dynamic import | `roomId` なしは `room_not_found` へ |

---

## ルーティング

| パス | コンポーネント | 説明 |
|------|---------------|------|
| `/` | `Home` | ローカル / オンライン選択 |
| `/local` | `LocalCanvas` | 端末内のみ。タブ閉じで消える |
| `/online?roomId=xxx` | `OnlineCanvas` | Firebase ルーム。24 時間有効 |
| `/errors/room_not_found` | `RoomNotFound` | 無効 roomId |
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
          ├─ Firebase RTDB (lines, view, image URL)
          └─ Firebase Storage (画像バイナリ)
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
       │    │    └─ Line[] (描画線)
       │    └─ Overlay
       │         ├─ BasicControl  … data-testid="mode-*"
       │         └─ ViewSharingControl (Online のみ)
       └─ RoomNotFound
```

### データモデル（Firebase Realtime Database）

```
rooms/{roomId}/
  ├── timestamp      # ルーム作成時刻（24h TTL の基準）
  ├── image          # Storage 画像 URL（文字列）
  ├── lines/{lineId}/
  │     ├── points   # [x0, y0, x1, y1, ...] または {index: value} で増分更新
  │     ├── isDrawing
  │     └── timestamp
  └── view/          # 視点共有
        ├── id       # リーダー UUID（競合解決用）
        ├── center   # {x, y}
        ├── area     # {width, height}
        └── rotation
```

### 描画・操作（Canvas 定数）

| 定数 | 値 | 場所 |
|------|-----|------|
| SCALE_MIN / MAX | 0.1 / 5 | `Canvas.tsx` |
| BACKGROUND_SIZE | 80000px | `Canvas.tsx` |
| 線色 / 太さ | red / 8 | `Canvas.tsx` |
| VIEW_SYNC_FPS | 30 | `hooks/useViewSharing.ts` |

### 視点共有（オンラインのみ）

| モード | 動作 |
|--------|------|
| `single` | 各自独立。view リスナー解除 |
| `leader` | 30fps で `rooms/{roomId}/view` に書き込み。`id` でリーダー競合を解決 |
| `follwer` | リーダーの view を受信して追従（**typo**: follower の意） |

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
- ルーム作成: `push(roomsRef, { image: "", lines: {}, timestamp: serverTimestamp() })`
- 描画中の線: `points` を index キーで `update` して増分同期
- 画像: Storage に `uploadBytes` → `getDownloadURL` → RTDB `image` に URL 保存

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
  └─ remote: set / update Firebase lines/{id}/points
```

### オンライン描画（受信側）

```
onChildAdded(linesRef)
  → DrawLine.of(snapshot) で Lines に追加
  → 描画中なら onChildAdded(points) + onValue(isDrawing) で増分監視
onChildRemoved(linesRef)
  → Lines.removeLine
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
npm run test:unit   # Vitest（math / ViewModel / LineModel）
npm run test:e2e    # Playwright（UI + 操作 + Emulator 連携）
npm run verify      # format + unit + e2e + build（エージェント向け一括検証）
```

| コマンド | 確認結果（2026-07-05） |
|---------|----------------------|
| `npm run build` | 成功。5 HTML ページ prerender |
| `npm run test:unit` | 35 テスト通過 |
| `npm run test:e2e` | Playwright + Firebase Emulator（要 Java 21・Chromium） |
| `eslint src` | エラーなし |

デプロイ先: Firebase Hosting（`dist/client`）。`firebase.json` で Cache-Control: no-cache。

---

## セキュリティ・運用

- **認証なし**。roomId を知る人が読み書き可能
- DB ルール: `rooms` への write は誰でも可。各 room は `timestamp + 24h` まで read/write
- Storage: read 全公開。write は 20MB 未満かつ `image/*` のみ
- Firebase 設定（apiKey 等）は `src/firebase.ts` に直書き（クライアントアプリとして一般的）
- 機微データの投入は想定外（`home_ja.md` にも明記）

---

## 既知の課題・技術的負債

調査時点で確認した事項。修正済みかは都度確認すること。

### タイポ・命名

| 項目 | 箇所 | 影響 |
|------|------|------|
| `"follwer"` | `types.ts`, `ViewSharingControl.tsx`, `OnlineCanvas.tsx` | DB 値・UI 値に波及。修正時は後方互換を考慮 |

### 潜在的バグ

| 項目 | 箇所 | 内容 |
|------|------|------|
| 自分/他人の線判定 | `hooks/useOnlineLines.ts:38` | `Object.keys(lines)` は Immutable `Lines` に対して誤り。意図は `lines.lines.has(key)` と推定。また `useEffect` のクロージャで `lines` が初期値のまま固定される |
| roomId なし遷移 | `pages/online/+Page.tsx:10` | `window.location.href` でリダイレクト（Vike の `navigate` 未使用） |

### インフラ・ツール

| 項目 | 内容 |
|------|------|
| テスト | ユニット 35 件（Vitest）+ E2E 10 件（Playwright）。初回は `npm run test:e2e:install` と `sudo env "PATH=$PATH" npx playwright install-deps chromium` |
| 依存 | `canvas` npm パッケージは削除済み（Konva ページはクライアント専用） |
| Node | Dev Container を Node 24 LTS に更新済み。再ビルド後に `node -v` で確認 |
| CI | 意図的に未導入（スキップ） |
| `.cursor/rules` | 6 ファイル（E2E 検証手順含む） |
| 最終更新 | 2024-02-11（git log） |

### 複雑度ホットスポット

1. **`hooks/useOnlineLines.ts`**（155 行）— Firebase 線の送受信・リスナー管理
2. **`hooks/useViewSharing.ts`**（131 行）— 視点共有・リーダー競合
3. **`Canvas.tsx`**（319 行）— マウス/タッチ/ホイール/慣性の入力処理

---

## AI コーディングレディ評価

本リポジトリを AI エージェントが安全に改修するための現状評価と推奨事項。

### 現状の強み（AI にとって扱いやすい点）

| 観点 | 評価 |
|------|------|
| 規模 | 約 2,000 行・33 ファイルと小さく、全体把握が容易 |
| 型安全性 | `strict: true`、主要ドメインに型定義あり |
| 責務分離 | `Canvas`（描画）と `Local/OnlineCanvas`（状態管理）が分離。オンライン同期は hooks に抽出済み |
| ドメインモデル | `ViewModel` / `Lines` が Immutable Record で明示的 |
| テスト | ユニット 35 + E2E 10。`npm run verify` でエージェント自律検証可能 |
| リンター | ESLint 設定が厳しめで、AI 生成コードの品質ガードになる |
| このファイル | プロジェクト概要・構成が文書化済み |

### 現状の弱み（AI がハマりやすい点）

| 観点 | リスク |
|------|--------|
| `useOnlineLines` の複雑さ | useEffect の依存配列・Firebase リスナー管理が難解 |
| typo の存在 | `"follwer"` 等、AI が「修正すべき」と誤判断し DB 互換を壊す可能性 |
| Immutable.js | 現行 React コードベースでは珍しく、AI が通常の object 操作を生成しがち |
| Vike v1 design | フレームワーク固有のファイル命名（`+Page.tsx`, `+config.h.ts`）を AI が知らない場合がある |
| Konva のクライアント専用化 | `/local` `/online` は dynamic import。SSR テストや E2E ではハイドレーション待ちが必要 |

### 推奨改善（優先度順）

AI コーディング環境を整えるための具体的な次ステップ。実施は別タスクとする。

| 優先度 | 施策 | 効果 |
|--------|------|------|
| 高 | `math.ts` / `ViewModel.ts` / `LineModel.ts` にユニットテスト追加 | 済（35 テスト） |
| 済 | Playwright E2E + `npm run verify` | UI/操作/オンライン（Emulator）をエージェント自律検証可能に |
| 済 | `OnlineCanvas.tsx` の同期ロジックをカスタムフックへ抽出 | `useOnlineRoomImage` / `useOnlineLines` / `useViewSharing` |
| 済 | Firebase Emulator Suite の導入 | RTDB/Storage エミュレータ + `firebase-tools` |
| 中 | `.cursor/rules/` にプロジェクト規約を追加（Immutable パターン、Vike 規則、typo 注意） | 済 |
| 済 | Node 24 LTS への Dev Container 更新 | `devcontainer.json` で `version: "24"` を指定済み |
| 済 | `useWindwosSize` → `useWindowSize` リネーム | `refactor/rename-use-window-size` で対応 |
| 低 | `"follwer"` → `"follower"` 修正 | DB 既存データとの互換が必要（両方受け入れ期間を設ける） |
| 済 | `canvas` 依存の削除 | Konva を `ssr.external` + ページ dynamic import で対応 |
| — | CI（lint + build + test）の追加 | スキップ（手動で `npm run verify` を確認） |
| 中 | Vite 5 化 | Vite 4 + Vitest 1.6 のまま。Vite 5 化後に Vitest 2+ へ上げられる |

---

## エージェント向け作業指針

### 変更前に読むべきファイル

| タスク | 必読ファイル |
|------|-------------|
| キャンバス操作（ズーム/回転/描画） | `Canvas.tsx`, `ViewModel.ts`, `math.ts` |
| ローカルモード | `LocalCanvas.tsx`, `LineModel.ts` |
| オンライン同期 | `hooks/useOnlineLines.ts`, `hooks/useOnlineRoomImage.ts`, `OnlineCanvas.tsx`, `database.rules.json`, `firebase.ts` |
| 視点共有 | `hooks/useViewSharing.ts`, `ViewSharingControl.tsx` |
| UI ツールバー | `BasicControl.tsx`, `Overlay.tsx` |
| E2E テスト | `e2e/helpers.ts`, `playwright.config.ts`, `.cursor/rules/e2e-verification.mdc` |
| 新ページ追加 | `src/pages/<route>/+Page.tsx`, `src/renderer/+config.h.ts` |
| SSR / メタ情報 | `src/renderer/+onRenderHtml.tsx` |

### 安全な変更パターン

1. **キャンバス変更** → `Canvas.tsx` と `ViewModel.ts` をセットで確認。Local / Online 両方に影響
2. **同期ロジック変更** → `hooks/useOnlineLines.ts` / `useOnlineRoomImage.ts` / `useViewSharing.ts` と `database.rules.json` をセットで確認
3. **新ページ追加** → Vike の `src/pages/` 配下に `+Page.tsx` を追加
4. **UI 変更** → MUI + 既存 `Overlay` / `ToggleButton` パターンに合わせる
5. **状態モデル** → Immutable.js の `Record` パターンを維持（直接 mutate しない）
6. **ビルド確認** → 変更後は `npm run verify` または `npm run build` + `npm run test:e2e`（UI 変更時）

### 避けるべきこと

- `Lines` / `ViewModel` の内部フィールドを直接書き換えない
- `"follwer"` を無断で `"follower"` に変更しない（既存ルームデータ・UI 状態に影響）
- `OnlineCanvas` / `useOnlineLines` の `useEffect` 依存配列を安易に変更しない（リスナーリーク・二重登録の原因）
- Firebase ルールを緩めない（認証なし設計のまま公開運用されている）
- 不要な抽象化レイヤーを追加しない（現状 2,000 行規模に対して過剰設計になりやすい）

### E2E 用 `data-testid`

| ID | 要素 |
|----|------|
| `enter-local` / `enter-online` | ホームのモード選択カード |
| `mode-move` / `mode-draw` / `mode-erase` | ツールバーのモード切替 |
| `clear-all` / `load-image` | 全消し・画像読み込み |
| `canvas-stage` | Konva Stage のラッパー |

オンライン E2E のルーム作成は Emulator REST API（`e2e/helpers.ts`、namespace `o-route-default-rtdb`）を使用。

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

---

## 更新履歴

| 日付 | 執筆者 | モデル | 内容 |
|------|--------|--------|------|
| 2026-07-05 | Cursor Agent（Composer） | Composer | 初版。リポジトリ全体の静的調査を反映 |
| 2026-07-05 | Cursor Agent（Composer） | Composer | Dev Container を Node 24 LTS に更新 |
| 2026-07-05 | Cursor Agent（Composer） | Composer | Vitest ユニットテスト、Firebase Emulator、OnlineCanvas フック分割、canvas 削除、Playwright E2E、`npm run verify` を反映 |
