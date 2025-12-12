# アーキテクチャ説明書

この文書は `n8tive`（n8n Desktop Wrapper）がローカル環境でどのように構成されるのかを、統一プロセスで定義された章立てに従って記述したものです。

#### 第1章 概要とアーキテクチャの定義 (Introduction and Architecture Definition)

##### 1.1. システムの責任範囲と境界
- ローカルホスト上で Electron アプリが起動し、同梱した `n8n` CLI を `child_process.fork()` で起動して `WebView` からアクセスする、自己完結型のクライアントアプリケーション。
- ユーザーは OS 上で Electron ウィンドウから n8n Editor と対話し、n8n のデータは `app.getPath('userData')/.n8n` 配下に保存される。
- 外部サービスとの通信は基本的になく、Webhook 受信などのサーバー的な公開は行わず、127.0.0.1 のみを監視する。
- アプリは主に Windows/macOS/Linux の各デスクトップ環境で動作し、Electron のビルトイン Node を利用して n8n のプロセスを起動・制御する。

##### 1.2. アーキテクチャに影響を与える要因（制約と原動力）
- n8n の依存が巨大（500MB 以上）であるため `electron-builder` の `asar` と `asarUnpack` を活用して容量と読み込み時間をコントロール。
- n8n の起動成功までの時間が 30秒〜1分と長いため、ローディング画面とログストリーミングで UX を補強。
- ポート 5678 をデフォルトとするが、競合時に `port-finder` モジュールで自動的に +1 ずつ探索し、実行中の n8n プロセスを常に `127.0.0.1` で固定。
- n8n の挙動を改造せず CLI をそのまま使うため、依存バージョンは最新安定版を追随し、設定は環境変数ベース。

##### 1.3. 採用するアーキテクチャのスタイル/パターン
- クライアント/サーバー型：Electron のメインプロセスが n8n サーバー（子プロセス）を管理し、レンダラープロセスが UI を表示。
- 機能的に層を分離（UI 表示・プロセスマネージャ・ポート探索・ログ送信）、サブシステム間は明示的な IPC と `contextBridge` で連携。
- アプリケーションのステートは n8n 側で保持し、Electron は「起動・監視・表示」のオーケストレータとして機能。

#### 第2章 機能とユースケースのビュー (Functional and Use-Case View)

##### 2.1. ユースケースモデルのビュー
1. **アプリ起動**: Electron 起動時、ローディング画面を表示しながら `N8nManager` が n8n CLI を新規プロセスで `fork()` し、ログ出力と準備完了の検知。
2. **n8n UI 表示**: ログから `Editor is now accessible via:` を検知したら `BrowserWindow` が `http://127.0.0.1:<port>` を読み込み、`WebView` 表示へ遷移。
3. **ログとエラー通知**: 標準出力・標準エラーを Renderer に流し、ロード画面上のラベルでステータス更新・エラーメッセージ表示。
4. **ポート競合解決**: デフォルト 5678 で接続できるかチェックし、空きポートが見つかるまで探索を継続。
5. **再起動/終了管理**: `ipcMain` で `restart-n8n` を受け取り `N8nManager` を再起動、ウィンドウクローズ時には n8n を終了させてからアプリ終了。

#### 第3章 概念的構造のビュー（分析モデルのビュー）

##### 3.1. 分析モデルの概要と分割
- `main` 側：Electron メイン + n8n プロセス制御 + ポート探索（`index.ts`, `n8n-manager.ts`, `port-finder.ts`）。
- `renderer` 側：ローディング画面 HTML とスタイル、ローカル `electronAPI` 経由でログ/状態イベントを受信。
- 共通インターフェイス：`preload.ts` で `contextBridge` により `ipcRenderer` の安全な公開を行い、Renderer は DOM だけに集中。

##### 3.2. 中心的な分析クラス
- `N8nManager`: n8n CLI の `fork()`、イベント監視、環境変数設定、ポート管理、再起動/停止処理。
- `PortFinder`: 非同期で空きポートを検出、最大 100 ポートまでループ。
- `Renderer Loader`: DOM でステータス更新とログ表示を行うクラス的役割。

#### 第4章 実現構造のビュー（設計モデルのビュー）

##### 4.1. 設計サブシステムとインターフェイス
- **プロセス管理サブシステム**（`N8nManager` + `PortFinder`）: `fork()` した n8n を監視し、`onLog/onReady/onError` コールバックを通じてメインウィンドウを更新。
- **UI 制御サブシステム**（`BrowserWindow` + ローディング HTML）: `mainWindow.loadFile()` → `loadURL()` 順で状態遷移、IPC/`contextBridge` でログと状態を受け取る。
- **ブリッジインターフェイス**（`preload.ts`）: Renderer に `onN8nLog/onN8nReady/onN8nError/restartN8n` を提供。

##### 4.2. 重要な設計クラスとアクティブクラス
- `N8nManager` はアクティブクラスとして n8n 子プロセスを保持し、`std(out|err)` と `exit` のコールバックで状態を更新。
- `BrowserWindow` は Renderer と `n8n` の状態を IPC で中継するアクティブな UI クラス。

##### 4.3. 汎用の設計メカニズム
- ロギング: メインと Renderer の間で `ipcMain`/`ipcRenderer` を使い、`stdin`/`stdout` のログをライブ表示。`preload` で `contextBridge` を用いて安全に公開。
- データ永続性: `app.getPath('userData')/.n8n` に n8n が持つデータを保存することで、再起動後もワークフローを保持。
- エラーハンドリング: `onError` で Renderer に通知、`stderr` 受信で処理。

##### 4.4. 重要なユースケースの実現（コラボレーション）
- アプリ起動は `index.ts` → `N8nManager.start()` → `fork()` → `stdin/stdout` 監視 → Renderer に `n8n-ready` → `mainWindow.loadURL()` という連携で実現。
- 再起動は IPC で `restart-n8n` を呼び出し、`N8nManager` の `stop()`/`start()` を順に実行。

#### 第5章 物理配置のビュー（配置モデルのビュー）

##### 5.1. ノードとネットワーク構成
- 単一ノード（ユーザーのデスクトップ）上で Electron メインプロセスと Renderer プロセスが動作。
- `n8n` 子プロセスも同じマシンで実行され、`127.0.0.1` を通じたローカルループバック通信のみ行う。
- すべての通信（Renderer ↔ メイン ↔ n8n）はプロセス内 IPC/HTTP に限定され、外部ネットワークへの公開はしない。

##### 5.2. コンポーネントとアクティブクラスの配置
- `N8nManager`/`PortFinder` は Electron Main プロセス内。`BrowserWindow` と `loading.html` は Renderer。
- `preload` は `BrowserWindow` に読み込まれ、Renderer と Main の橋渡し（`contextBridge`）。

#### 第6章 実装のビュー (Implementation View)

##### 6.1. アーキテクチャ上重要なコンポーネント
- `src/main/index.ts`: 起動フロー（ウィンドウ生成、ローディング表示、n8n 管理、イベント）、`ipcMain` ハンドラ。
- `src/main/n8n-manager.ts`: n8n CLI の `fork`/`stop`/`restart`、ポート探索、ログ解析、コールバック。
- `src/main/port-finder.ts`: `net.createServer()` を用いた空きポート検出。
- `src/main/preload.ts`: `contextBridge` でログ/イベント/再起動インターフェイスを公開。
- `src/renderer/loading.html`: UI と CSS、`electronAPI` を使った DOM 操作。
- `electron-builder.yml`: 各プラットフォーム用ビルド設定（AppID, icon, ターゲット）。

##### 6.2. 実装モデルの構造
- `package.json` (`dependencies` に `n8n`, `devDependencies` に Electron/Vite 等) を中心にビルド/パッケージングスクリプトを定義。
- `resources/icon.*` や `tsconfig.json` など周辺ファイルも含め、`electron-vite build` → `electron-builder` のパイプラインを確立。

