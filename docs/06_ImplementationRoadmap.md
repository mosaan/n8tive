# n8tive 実装ロードマップ・検証

## 実装フェーズ
1. **Phase 1: 基本構造** – `package.json`・TypeScript・Electron ウィンドウのセットアップ。`electron-vite dev` でローディング画面を表示確認。
2. **Phase 2: n8n 起動** – `N8nManager` の `fork()`、ログストリーミング、再起動/停止、`findAvailablePort` を導入。
3. **Phase 3: UI 統合** – `loading.html` でログ/ステータス表示、`ready` イベントで `loadURL`、エラー表示対応。
4. **Phase 4: ビルド・パッケージング** – `electron-builder.yml` を整備してWindows（NSIS）でパッケージングを確認。

## 既知の課題・制限
- **パッケージサイズ**: n8n 依存が 500MB 以上。`asar` 圧縮と `asarUnpack` 設定で管理。
- **起動時間**: 初回起動に 30〜60 秒。ローディング画面とログで体感を改善。
- **Windows の挙動**: `child_process.fork()` やパス区切り文字の取り扱いに注意が必要。
- **Webhook/外部アクセス**: ローカル専用のため外部リクエストは受け付けない。必要ならドキュメントで明示する。

## テスト項目
- [x] n8n サーバーの起動確認 (`onReady` 発火)
- [x] ポート競合時の自動切り替え
- [x] アプリ終了時の n8n プロセスを確実に終了 (`stop()`)
- [x] ワークフロー作成・実行（UI 経由）
- [x] データ永続性（再起動後も `.n8n` が残る）
- [ ] Windows でのパッケージング・起動

## 参考リンク
- n8n 公式: https://n8n.io/
- n8n GitHub: https://github.com/n8n-io/n8n
- Electron: https://www.electronjs.org/
- electron-vite: https://electron-vite.org/
- electron-builder: https://www.electron.build/
