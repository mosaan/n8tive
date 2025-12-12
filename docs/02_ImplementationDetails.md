# n8tive 実装詳細

## 本文書の目的
この文書にはn8tive の技術的構成・設計・実装の詳細（コード例含む）を収録します。概要/計画を `docs/01_Architecture.md` および `docs/00_ProjectPlan.md` で確認しつつ、本書で実際のコードや設定を参照してください。

## 概要

Electron 組み込みの Node.js を利用して n8n サーバーをローカル起動し、Electron Renderer から WebView で接続する薄いデスクトップラッパーを構築する。n8n 本体には手を加えず、最新の n8n を Electron ラッパーから直に起動してデスクトップ的な UX を実現する。

**目標**
- Node.js の事前インストールを不要にし、ダウンロード→起動だけで n8n が使えるようにする。
- n8n 側の大規模な改造を避け、常に最新の n8n CLI を `child_process.fork()` で呼び出す。これにより n8n 本体のバージョン追従をシンプルに保つ。

## 技術的アプローチ

### コアコンセプト

```
┌─────────────────────────────────────────────────────┐
│                 Electron App                        │
├─────────────────────────────────────────────────────┤
│  Main Process (Node.js)                             │
│  ┌───────────────────────────────────────────────┐  │
│  │  n8n Server (child_process.fork)              │  │
│  │  - packages/cli/bin/n8n を直接実行            │  │
│  │  - localhost:5678 で待機                      │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  Renderer Process                                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  BrowserWindow / WebView                      │  │
│  │  - http://localhost:5678 を表示               │  │
│  │  - 起動中はローディング画面                   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 重要な設計判断

1. **n8n の組み込み**: `dependencies` に n8n を含め、`child_process.fork()` で CLI エントリポイント（`node_modules/n8n/bin/n8n`）を直接起動。
2. **データ永続化**: `app.getPath('userData')` 配下に `.n8n` ディレクトリを作成して n8n データを保存。
3. **ポート管理**: デフォルト 5678 から開始し、競合があれば `port-finder` で別ポートを順に探索。

## ファイル構成

```
n8n-desktop/
├── package.json
├── electron-builder.yml       # ビルド設定
├── src/
│   ├── main/
│   │   ├── index.ts           # Electron メインプロセス
│   │   ├── n8n-manager.ts     # n8n プロセス管理
│   │   ├── port-finder.ts     # 空きポート検索
│   │   └── preload.ts         # preload スクリプト
│   └── renderer/
│       ├── index.html         # メイン HTML（WebView含む）
│       ├── loading.html       # ローディング画面
│       └── styles.css
├── resources/
│   └── icon.png               # アプリアイコン
└── tsconfig.json
```

## 詳細仕様

### 1. package.json

```json
{
  "name": "n8n-desktop",
  "version": "1.0.0",
  "description": "Desktop wrapper for n8n workflow automation",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-builder"
  },
  "dependencies": {
    "n8n": "^1.70.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.3.0",
    "typescript": "^5.0.0"
  }
}
```

**注意**: n8n 依存は非常に大きいためインストールに時間がかかる。

### 2. src/main/index.ts - メインプロセス

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { N8nManager } from './n8n-manager';

let mainWindow: BrowserWindow | null = null;
let n8nManager: N8nManager | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false, // 準備完了まで非表示
  });

  // ローディング画面を表示
  mainWindow.loadFile(path.join(__dirname, '../renderer/loading.html'));
  mainWindow.show();

  // n8n 起動
  n8nManager = new N8nManager({
    userDataPath: app.getPath('userData'),
    onLog: (log) => {
      mainWindow?.webContents.send('n8n-log', log);
    },
    onReady: (url) => {
      mainWindow?.webContents.send('n8n-ready', url);
      // n8n UI に遷移
      mainWindow?.loadURL(url);
    },
    onError: (error) => {
      mainWindow?.webContents.send('n8n-error', error);
    },
  });

  await n8nManager.start();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  await n8nManager?.stop();
  app.quit();
});

// 再起動コマンド
ipcMain.handle('restart-n8n', async () => {
  await n8nManager?.restart();
});
```

### 3. src/main/n8n-manager.ts - n8n プロセス管理

```typescript
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { findAvailablePort } from './port-finder';

interface N8nManagerOptions {
  userDataPath: string;
  onLog: (log: string) => void;
  onReady: (url: string) => void;
  onError: (error: string) => void;
}

export class N8nManager {
  private process: ChildProcess | null = null;
  private options: N8nManagerOptions;
  private port: number = 5678;
  private isReady: boolean = false;

  constructor(options: N8nManagerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    // 空きポートを探す
    this.port = await findAvailablePort(5678);
    
    // n8n の CLI エントリポイントを特定
    const n8nBinPath = require.resolve('n8n/bin/n8n');
    const n8nUserFolder = path.join(this.options.userDataPath, '.n8n');

    const env = {
      ...process.env,
      N8N_USER_FOLDER: n8nUserFolder,
      N8N_PORT: String(this.port),
      N8N_DIAGNOSTICS_ENABLED: 'false',
      N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
      N8N_HOST: '127.0.0.1',
    };

    this.process = fork(n8nBinPath, ['start'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    this.process.stdout?.on('data', (data) => {
      const log = data.toString();
      this.options.onLog(log);
      
      if (log.includes('Editor is now accessible via:') || 
          log.includes(`localhost:${this.port}`)) {
        if (!this.isReady) {
          this.isReady = true;
          this.options.onReady(`http://127.0.0.1:${this.port}`);
        }
      }
    });

    this.process.stderr?.on('data', (data) => {
      this.options.onLog(`[stderr] ${data.toString()}`);
    });

    this.process.on('error', (err) => {
      this.options.onError(`Failed to start n8n: ${err.message}`);
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        this.options.onError(`n8n exited with code ${code}`);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }
      this.process = null;
      this.isReady = false;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }
}
```

### 4. src/main/port-finder.ts - ポート検索

```typescript
import net from 'net';

export async function findAvailablePort(startPort: number): Promise<number> {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error('No available port found');
    }
  }
  return port;
}
```

### 5. src/main/preload.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onN8nLog: (callback: (log: string) => void) => {
    ipcRenderer.on('n8n-log', (_, log) => callback(log));
  },
  onN8nReady: (callback: (url: string) => void) => {
    ipcRenderer.on('n8n-ready', (_, url) => callback(url));
  },
  onN8nError: (callback: (error: string) => void) => {
    ipcRenderer.on('n8n-error', (_, error) => callback(error));
  },
  restartN8n: () => ipcRenderer.invoke('restart-n8n'),
});
```

### 6. src/renderer/loading.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>n8n Desktop - Starting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #ff6d5a 0%, #ff4f81 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 600px;
      padding: 20px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .subtitle {
      opacity: 0.9;
      margin-bottom: 30px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 30px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .log-container {
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      padding: 15px;
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
    }
    .log-line {
      margin: 2px 0;
      opacity: 0.9;
    }
    .status {
      margin-top: 20px;
      font-size: 14px;
    }
    .error {
      background: rgba(255,0,0,0.3);
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>n8n Desktop</h1>
    <p class="subtitle">Workflow Automation</p>
    <div class="spinner" id="spinner"></div>
    <div class="status" id="status">Starting n8n server...</div>
    <div class="log-container" id="logs"></div>
    <div class="error" id="error" style="display:none;"></div>
  </div>

  <script>
    const logsEl = document.getElementById('logs');
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    const spinnerEl = document.getElementById('spinner');

    function addLog(text) {
      const line = document.createElement('div');
      line.className = 'log-line';
      line.textContent = text.trim();
      logsEl.appendChild(line);
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    window.electronAPI.onN8nLog((log) => {
      addLog(log);
    });

    window.electronAPI.onN8nReady((url) => {
      statusEl.textContent = `Ready! Connecting to ${url}...`;
      spinnerEl.style.borderTopColor = '#4ade80';
    });

    window.electronAPI.onN8nError((error) => {
      spinnerEl.style.display = 'none';
      statusEl.textContent = 'Error occurred';
      errorEl.style.display = 'block';
      errorEl.textContent = error;
    });
  </script>
</body>
</html>
```

### 7. electron-builder.yml - ビルド設定

```yaml
appId: com.local.n8n-desktop
productName: n8n Desktop
directories:
  output: release
files:
  - dist/**/*
  - node_modules/**/*
  - "!node_modules/*/{CHANGELOG.md,README.md,readme.md,test,tests,__tests__}"
asar: true
asarUnpack:
  - node_modules/n8n/**/*
  - node_modules/@n8n/**/*

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: resources/icon.icns
  category: public.app-category.developer-tools

linux:
  target:
    - target: AppImage
      arch: [x64]
  icon: resources/icon.png
  category: Development

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

## 実装の順序

1. **Phase 1: 基本構造**
   - package.json 作成、依存関係インストール
   - TypeScript 設定
   - Electron ウィンドウの表示
2. **Phase 2: n8n 起動**
   - n8n-manager.ts 実装
   - プロセス起動・終了
   - ログストリーミング
3. **Phase 3: UI 統合**
   - ローディング画面
   - n8n 準備完了検出 → URL 遷移
   - エラーハンドリング
4. **Phase 4: ビルド・パッケージング**
   - electron-builder 設定
   - 各プラットフォーム向けビルドテスト

## 既知の課題・制限事項

### パッケージサイズ
- n8n の依存が大きく、500MB 以上に達する可能性。
- `asar` 圧縮と `asarUnpack` で軽減を試みる。

### 起動時間
- n8n の初回起動が 30 秒〜1 分程度かかる可能性。
- ローディング画面でユーザー体験を改善。

### Windows 固有
- `child_process.fork()` の挙動、パス区切りの違いなどは追加検証が必要。

### Webhook
- ローカル専用のため、外部からの Webhook 受信には対応しない。
- スケジューラーやマニュアル実行に限定。

## テスト項目

- [ ] n8n サーバーの起動確認
- [ ] ポート競合時の自動切り替え
- [ ] アプリ終了時の n8n プロセスを確実に終了
- [ ] ワークフロー作成・実行
- [ ] データの永続化（再起動後もワークフローが残る）
- [ ] Windows/macOS/Linux でのビルド

## 参考リンク

- n8n 公式: https://n8n.io/
- n8n GitHub: https://github.com/n8n-io/n8n
- Electron: https://www.electronjs.org/
- electron-vite: https://electron-vite.org/
- electron-builder: https://www.electron.build/
