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

### `src/main/port-finder.ts`
- `net.createServer()` を使って 5678 から順にポートを試行し、最大 100 個の範囲で空きポートを返却する。エラー時は例外を投げる。

### `src/main/preload.ts`
- `contextBridge.exposeInMainWorld` で Renderer に安全な API (`onN8nLog`, `onN8nReady`, `onN8nError`, `restartN8n`) を公開し、直接 Node API へ触れさせない。

### `src/renderer/loading.html`
- ローディング UI でログコンテナ・ステータスメッセージ・スピナー・エラー表示領域をDOMで用意。
- `window.electronAPI` を通じてログやステータスを受信し、Ready/エラー時に表示を更新。`loading.html`は起動完了後 `BrowserWindow.loadURL` で n8n UI に切り替わる。

### `electron-builder.yml`
- `asar` 通常化と `asarUnpack` で `node_modules/n8n` や `@n8n` を展開。各プラットフォーム（Win: nsis, mac: dmg, Linux: AppImage）のアイコンやカテゴリ、NSIS のインストーラ設定（`oneClick`, インストール先変更許可）を定義。

### `package.json` / `tsconfig.json`
- `package.json` は `dev`/`build`/`package`スクリプト、`dependencies` に `n8n`, `devDependencies` に Electron/Vite/TypeScript、`main` を `dist/main/index.js` に設定。
- `tsconfig.json` では `src/main`・`src/renderer` を含むビルド対象、ES2021 相当のターゲット、`node`/`dom` のプリセットなどを指定。

### リソース
- `resources/icon.*` は Electron ビルドで使用するアプリアイコン。`loading.html` や他の Renderer ファイルには追加のスタイル/HTML (`styles.css`, `index.html`) を置いて拡張可能。

## 補足
- 実装の順序や既知の課題・テスト項目は `docs/00_ProjectPlan.md` に移行済みなので、本書ではソースコードの責務や構成にフォーカスしています。
- コードの詳細な動作を確認したい場合は各ファイルを開いて最新の内容を確認してください（例: `src/main/n8n-manager.ts` でポート検出やログの解析を確認）。
