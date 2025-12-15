# n8tive 実装リファレンス

## 本文書の位置づけ
`docs/00_Architecture.md` が責務・アーキテクチャの高レベル解説、`docs/00_ProjectPlan.md` が開発構想と計画を担う中、本書はソースコードやビルド設定のポイントをまとめた参照用ドキュメントです。コード全文を再掲するのではなく、各ファイルの役割・重要なフロー・設定項目を整理して、開発者が何を確認すればよいかを見通せるようにします。実際の詳細は各ソースファイルを直接確認してください。

## 詳細実装の参照
- `docs/03_MainProcess.md`: Electron メイン・`N8nManager`・`port-finder`・`preload` に対するコードサンプルと解説。
- `docs/04_RendererUI.md`: ローディング HTML および Renderer 側のイベントハンドリングと UI 構成。
- `docs/05_BuildPackaging.md`: `package.json`/`electron-builder.yml` を中心としたビルド構成とリソース説明。
- `docs/06_ImplementationRoadmap.md`: 実装フェーズ・既知課題・テスト項目・参考リンクなどのロードマップ。

## ファイルごとのリファレンス

### `src/main/index.ts`
- Electron メインプロセス。`BrowserWindow` の生成・ローディング画面の表示・`N8nManager` の起動とイベントブリッジを担う。
- `ipcMain.handle('restart-n8n')` で再起動要求を受けて `N8nManager` の `restart()` を呼び出す。

### `src/main/n8n-manager.ts`
- n8n CLI を `fork()` し、`stdout/stderr` からのログを Renderer に転送。`findAvailablePort` で空きポートを選び、`N8N_USER_FOLDER`, `N8N_PORT`, `N8N_HOST` などの環境変数を設定。
- `start/stop/restart` を実装し、プロセス終了時のログやエラーを `onReady/onLog/onError` でメインへ通知する。
- **データ保存場所**: `N8N_USER_FOLDER` に `app.getPath('userData')` を設定。n8n は内部的に `N8N_USER_FOLDER/.n8n/` ディレクトリを作成し、そこに `database.sqlite`、ワークフロー設定、ログなどを保存する。

### `src/main/port-finder.ts`
- `net.createServer()` を使って 5678 から順にポートを試行し、最大 100 個の範囲で空きポートを返却する。エラー時は例外を投げる。

### `src/main/preload.ts`
- `contextBridge.exposeInMainWorld` で Renderer に安全な API (`onN8nLog`, `onN8nReady`, `onN8nError`, `restartN8n`) を公開し、直接 Node API へ触れさせない。

### `src/renderer/loading.html`
- ローディング UI でログコンテナ・ステータスメッセージ・スピナー・エラー表示領域をDOMで用意。
- `window.electronAPI` を通じてログやステータスを受信し、Ready/エラー時に表示を更新。`loading.html`は起動完了後 `BrowserWindow.loadURL` で n8n UI に切り替わる。

### `electron-builder.yml`
- `asar: true` でアプリコードを圧縮。n8n は `extraResources` で `n8n-dist` ディレクトリ全体をコピー（ジャンクション方式により `n8n_modules` が実体として同梱され、`afterPack` hook で `node_modules` にリネーム）。Windows（nsis）向けのアイコンとNSIS インストーラ設定（`oneClick: false`, インストール先変更許可）を定義。

### `package.json` / `tsconfig.json`
- `package.json` は `dev`/`build`/`prepare:n8n`/`package`スクリプトを定義。n8n は `dependencies` ではなく `scripts/prepare-n8n.js` で別途 `n8n-dist/` にインストール。`devDependencies` に Electron/Vite/TypeScript/electron-builder、`main` を `out/main/index.js` に設定。
- `tsconfig.json` では `src/main`・`src/renderer` を含むビルド対象、ES2021 相当のターゲット、`node`/`dom` のプリセットなどを指定。

### `scripts/prepare-n8n.js`
- n8n とその依存関係を `n8n-dist/` ディレクトリにインストールする準備スクリプト。
- `npm install` で `node_modules` にインストール後、`n8n_modules` にリネームし、`node_modules` ジャンクション（`n8n_modules` へのリンク）を作成。
- これにより開発時は `node_modules` ジャンクション経由で参照、ビルド時は `n8n_modules` 実体のみがコピーされる。
- マーカーファイル（`.n8n-prepared`）で重複実行を防止。

### `scripts/after-pack.js`
- electron-builder の `afterPack` hook として実行されるスクリプト。
- パッケージ後の `resources/n8n-dist/n8n_modules` を `node_modules` にリネームし、実行時に正常に参照できるようにする。

### リソース
- `resources/icon.*` は Electron ビルドで使用するアプリアイコン。`loading.html` や他の Renderer ファイルには追加のスタイル/HTML (`styles.css`, `index.html`) を置いて拡張可能。

## データ保存場所

### ユーザーデータディレクトリ
n8tive は Electron の `app.getPath('userData')` をベースにデータを保存します。

- **Windows**: `%APPDATA%\n8tive\` (例: `C:\Users\<username>\AppData\Roaming\n8tive\`)

### n8n データフォルダ
n8n は `N8N_USER_FOLDER` 環境変数で指定されたディレクトリ内に `.n8n` サブディレクトリを自動作成します。

- **設定**: `N8N_USER_FOLDER = app.getPath('userData')` (src/main/n8n-manager.ts)
- **実際のデータ保存先**: `{userData}/.n8n/`
  - Windows: `C:\Users\<username>\AppData\Roaming\n8tive\.n8n\`

### 保存されるデータ
`.n8n/` ディレクトリには以下が保存されます：

- `database.sqlite` - ワークフロー、実行履歴、認証情報などを格納する SQLite データベース
- `config` - n8n の設定ファイル
- `n8nEventLog.log` - n8n のイベントログ
- `binaryData/` - ワークフロー実行時のバイナリデータ
- `nodes/` - カスタムノード
- `ssh/`, `git/` - Git 統合用の鍵と設定

## 補足
- 実装の順序や既知の課題・テスト項目は `docs/00_ProjectPlan.md` に移行済みなので、本書ではソースコードの責務や構成にフォーカスしています。
- コードの詳細な動作を確認したい場合は各ファイルを開いて最新の内容を確認してください（例: `src/main/n8n-manager.ts` でポート検出やログの解析を確認）。
