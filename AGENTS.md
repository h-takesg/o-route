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
| 調査方法 | リポジトリ全ファイルの静的読解、`npm run build` / `eslint src` の実行確認 |
| 実行確認 | `npm run build` 成功（tsc + vite build + prerender 5 ページ）、`eslint src` エラーなし |
| 信頼度 | コード構造・依存関係・設計意図・ビルドは**高**。ランタイム挙動・Firebase 実環境・オンライン同期の実機検証は**未実施** |

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
| 総行数 | 約 1,600 行（`src/` 内 TypeScript/TSX） |
| ファイル数 | 29 ファイル（`src/` 内） |

---

## 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| UI | React 18, TypeScript 5.1, MUI 5, react-icons | 関数コンポーネントのみ |
| キャンバス | Konva 9, react-konva 18, use-image | SSR 時は canvas 要素なし |
| ルーティング / SSR | Vike 0.4（`prerender: true`, `clientRouting: true`） | v1 design（`+config.h.ts`） |
| ビルド | Vite 4 | `ssr.noExternal: ["react-icons"]` |
| 状態モデル | Immutable.js 4（`Record`, `Map`, `List`） | 直接 mutate 禁止 |
| BaaS | Firebase 10（RTDB, Storage, Hosting） | 認証なし |
| 品質 | ESLint 8 + Prettier 3 | テストフレームワークなし |
| 開発環境 | Dev Container（Ubuntu jammy, **Node 19**） | 現状は EOL。アップグレード目標は **Node 24 LTS**（未実施） |

---

## ディレクトリ構成

```
/workspaces/tizuyomi/
├── src/
│   ├── pages/              # Vike ファイルベースルーティング
│   │   ├── index/          # ホーム（モード選択）
│   │   ├── local/          # ローカルモード
│   │   ├── online/         # オンラインモード（独自 onRenderHtml）
│   │   ├── errors/room_not_found/
│   │   └── _error/         # 404/500
│   ├── components/         # UI・キャンバス（9 ファイル）
│   ├── models/             # ViewModel, DrawLine, Lines
│   ├── hooks/              # useDatabaseRef, useWindowSize（ファイル名 typo）
│   ├── renderer/           # SSR / クライアントハイドレーション
│   ├── documents/          # home_ja.md（ホーム画面 Markdown）
│   ├── firebase.ts         # Firebase 初期化（設定値直書き）
│   ├── math.ts             # Vector, 線分交差判定
│   └── types.ts            # Mode, ViewMode
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
| `Canvas.tsx` | 319 | Konva Stage、パン/ズーム/回転、描画/消去イベント、慣性スクロール | Local/Online 共通。定数（SCALE_MIN/MAX 等）はここにハードコード |
| `OnlineCanvas.tsx` | 333 | Firebase 同期の中枢。描画・画像・視点共有 | 最も複雑。useEffect が 7 箇所。同期バグの温床 |
| `LocalCanvas.tsx` | 79 | ローカル state のみ。`URL.createObjectURL` で画像 | OnlineCanvas の簡易版。同期ロジックなし |
| `ViewModel.ts` | 47 | 位置・スケール・回転の Immutable Record | `move` / `scaleAt` / `rotateAt` は純粋関数 |
| `LineModel.ts` | 112 | DrawLine / Lines。消しゴムの交差判定 | ローカルは連番キー、オンラインは Firebase push キー |
| `math.ts` | 89 | Vector クラス、線分交差、clamp | テスト追加の候補（純粋関数が多い） |
| `Home.tsx` | 111 | モード選択、ルーム作成（`push` + `navigate`） | Firebase 書き込みあり |
| `BasicControl.tsx` | 144 | ツールバー（移動/ペン/消しゴム/全消し/画像） | MUI ToggleButton パターン。MUI icons の default export 回避ハックあり |
| `ViewSharingControl.tsx` | 52 | 視点共有モード切替（オンラインのみ） | `"follwer"` typo に注意 |
| `hooks/useDatabaseRef.ts` | 13 | Firebase ref を useState で 1 回生成 | path は roomId 依存で不変想定 |
| `hooks/useWindowSize.ts` | 18 | window resize リスナー | |
| `pages/online/+Page.tsx` | 19 | `roomId` クエリ取得。なければリダイレクト | `window.location` 直叩き（SSR 非対応だが CSR で動作） |

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
          ├─ Firebase RTDB (lines, view, image URL)
          └─ Firebase Storage (画像バイナリ)
```

### コンポーネント階層

```
PageShell (StrictMode)
  └─ Page (+Page.tsx)
       ├─ Home
       ├─ LocalCanvas / OnlineCanvas
       │    ├─ Canvas (Konva Stage > Layer > Group)
       │    │    ├─ Rect (背景 80000px)
       │    │    ├─ MapImage (use-image)
       │    │    └─ Line[] (描画線)
       │    └─ Overlay
       │         ├─ BasicControl
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
| VIEW_SYNC_FPS | 30 | `OnlineCanvas.tsx` |

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
- オンラインページのみ `+onRenderHtml.tsx` でカスタム HTML（SEO メタ付き）
- クライアント専用 API（`window`, Firebase listener）は `useEffect` 内か CSR 前提のページで使用
- `react-icons` は SSR でバンドルに含める必要あり（`vite.config.ts` の `ssr.noExternal`）

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
```

| コマンド | 確認結果（2026-07-05） |
|---------|----------------------|
| `npm run build` | 成功。5 HTML ページ prerender |
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
| 自分/他人の線判定 | `OnlineCanvas.tsx:161` | `Object.keys(lines)` は Immutable `Lines` Record に対して誤り。意図は `lines.lines.has(key)` と推定。また `useEffect([], [])` のクロージャで `lines` が初期値のまま固定される |
| roomId なし遷移 | `pages/online/+Page.tsx:10` | `window.location.href` でリダイレクト（Vike の `navigate` 未使用） |

### インフラ・ツール

| 項目 | 内容 |
|------|------|
| テスト | ユニット / E2E テストなし |
| 依存 | `canvas` npm パッケージが dependencies にあるが src 内未使用（SSR/Konva 用の可能性） |
| Node | 現状 Node 19（EOL）。順次対応のため**まだ上げない**。目標は Node 24 LTS（Active LTS） |
| CI | GitHub Actions 等の設定なし |
| `.cursor/rules` | 未整備 |
| 最終更新 | 2024-02-11（git log） |

### 複雑度ホットスポット

1. **`OnlineCanvas.tsx`**（333 行）— Firebase 同期・視点共有・描画が 1 ファイルに集中
2. **`Canvas.tsx`**（319 行）— マウス/タッチ/ホイール/慣性の入力処理
3. **`BasicControl.tsx`**（144 行）— MUI icons の workaround が冗長

---

## AI コーディングレディ評価

本リポジトリを AI エージェントが安全に改修するための現状評価と推奨事項。

### 現状の強み（AI にとって扱いやすい点）

| 観点 | 評価 |
|------|------|
| 規模 | 約 1,600 行・29 ファイルと小さく、全体把握が容易 |
| 型安全性 | `strict: true`、主要ドメインに型定義あり |
| 責務分離 | `Canvas`（描画）と `Local/OnlineCanvas`（状態管理）が分離 |
| ドメインモデル | `ViewModel` / `Lines` が Immutable Record で明示的 |
| リンター | ESLint 設定が厳しめで、AI 生成コードの品質ガードになる |
| このファイル | プロジェクト概要・構成が文書化済み |

### 現状の弱み（AI がハマりやすい点）

| 観点 | リスク |
|------|--------|
| テストなし | リグレッション検出手段がない。AI の変更が壊れても気づきにくい |
| `OnlineCanvas` の複雑さ | useEffect の依存配列・Firebase リスナー管理が難解 |
| typo の存在 | `"follwer"` 等、AI が「修正すべき」と誤判断し DB 互換を壊す可能性 |
| Immutable.js | 現行 React コードベースでは珍しく、AI が通常の object 操作を生成しがち |
| Vike v1 design | フレームワーク固有のファイル命名（`+Page.tsx`, `+config.h.ts`）を AI が知らない場合がある |
| Firebase 実環境 | エミュレータ設定なし。オンライン機能のローカル検証が困難 |

### 推奨改善（優先度順）

AI コーディング環境を整えるための具体的な次ステップ。実施は別タスクとする。

| 優先度 | 施策 | 効果 |
|--------|------|------|
| 高 | `math.ts` / `ViewModel.ts` / `LineModel.ts` にユニットテスト追加 | 純粋関数が多く ROI が高い。AI 変更の安全網になる |
| 高 | `OnlineCanvas.tsx` の同期ロジックをカスタムフックへ抽出 | AI が局所変更しやすくなる |
| 高 | Firebase Emulator Suite の導入 | `chore/firebase-emulator` で対応 |
| 中 | `.cursor/rules/` にプロジェクト規約を追加（Immutable パターン、Vike 規則、typo 注意） | エージェントの一貫性向上 |
| 中 | Node 24 LTS への Dev Container 更新 | 目標は Node 24 LTS（Active LTS）。`devcontainer.json` の変更は未実施 |
| 済 | `useWindwosSize` → `useWindowSize` リネーム | `refactor/rename-use-window-size` で対応 |
| 低 | `"follwer"` → `"follower"` 修正 | DB 既存データとの互換が必要（両方受け入れ期間を設ける） |
| 低 | `canvas` 依存の要否調査・削除 | ビルド時間・ネイティブ依存の削減 |
| 低 | CI（lint + build + test）の追加 | PR 品質の自動担保 |

---

## エージェント向け作業指針

### 変更前に読むべきファイル

| タスク | 必読ファイル |
|------|-------------|
| キャンバス操作（ズーム/回転/描画） | `Canvas.tsx`, `ViewModel.ts`, `math.ts` |
| ローカルモード | `LocalCanvas.tsx`, `LineModel.ts` |
| オンライン同期 | `OnlineCanvas.tsx`, `database.rules.json`, `firebase.ts` |
| 視点共有 | `OnlineCanvas.tsx`（viewMode useEffect）, `ViewSharingControl.tsx` |
| UI ツールバー | `BasicControl.tsx`, `Overlay.tsx` |
| 新ページ追加 | `src/pages/<route>/+Page.tsx`, `src/renderer/+config.h.ts` |
| SSR / メタ情報 | `src/renderer/+onRenderHtml.tsx`, 各ページの `+onRenderHtml.tsx` |

### 安全な変更パターン

1. **キャンバス変更** → `Canvas.tsx` と `ViewModel.ts` をセットで確認。Local / Online 両方に影響
2. **同期ロジック変更** → `OnlineCanvas.tsx` と `database.rules.json` をセットで確認
3. **新ページ追加** → Vike の `src/pages/` 配下に `+Page.tsx` を追加
4. **UI 変更** → MUI + 既存 `Overlay` / `ToggleButton` パターンに合わせる
5. **状態モデル** → Immutable.js の `Record` パターンを維持（直接 mutate しない）
6. **ビルド確認** → 変更後は `npm run build` を実行（tsc + prerender）

### 避けるべきこと

- `Lines` / `ViewModel` の内部フィールドを直接書き換えない
- `"follwer"` を無断で `"follower"` に変更しない（既存ルームデータ・UI 状態に影響）
- `OnlineCanvas` の `useEffect` 依存配列を安易に変更しない（リスナーリーク・二重登録の原因）
- Firebase ルールを緩めない（認証なし設計のまま公開運用されている）
- 不要な抽象化レイヤーを追加しない（現状 1,600 行規模に対して過剰設計になりやすい）

### 変更後の確認手順

```bash
npm run format   # lint + format
npm run build    # 型チェック + ビルド + prerender
npm run dev      # 手動確認（ローカルモードは Firebase 不要）
```

オンライン機能の確認には Firebase 実プロジェクトまたは Emulator が必要。

### Firebase Emulator（ローカル開発）

> **要 Node 20+**: `firebase-tools` CLI は Node 19 では動作しません。Dev Container の Node 24 LTS 化後、または Node 20+ の環境で利用してください。

```bash
# エミュレータ + dev サーバーをまとめて起動
npm run dev:emulator

# 別ターミナルで使う場合
npm run emulators
# 別途 .env.development.local に VITE_USE_FIREBASE_EMULATOR=true を設定して npm run dev
```

- Emulator UI: http://127.0.0.1:4000
- RTDB: port 9000 / Storage: port 9199（`firebase.json` で定義）
- CLI は `npx firebase-tools@13.29.1` を scripts から呼び出し（devDependencies には含めない）

---

## 更新履歴

| 日付 | 執筆者 | モデル | 内容 |
|------|--------|--------|------|
| 2026-07-05 | Cursor Agent（Composer） | Composer | 初版。リポジトリ全体の静的調査を反映 |
| 2026-07-05 | Cursor Agent（Composer） | Composer | 開発環境の Node アップグレード目標を Node 24 LTS に設定（実際のバージョン変更は未実施） |
