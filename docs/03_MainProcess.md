# n8tive Main Process 実装案

## 目的と全体像
Electron のメインプロセスが n8n サーバー（child process）を直接管理し、ローディング画面→n8n UI への遷移、および再起動/シャットダウンのライフサイクルを担う箇所です。目標は、Node 事前インストール不要にするため `n8n` CLI を `fork()` し、ローカルホスト上の HTTP を WebView で表示することに集中することです。

```
┌────────────────────────────────────────────────────────────────┐
│ Electron メイン                                                 │
│ ┌──────────────┐     ┌──────────────┐       ┌──────────────┐   │
│ │ BrowserWindow│ <-> │IPC/Bridge    │ <->   │N8nManager    │   │
│ └──────────────┘     └──────────────┘       └──────────────┘   │
│         │                     │                   │             │
│         ▼                     ▼                   ▼             │
│      Renderer             preload.ts           fork n8n CLI     │
└────────────────────────────────────────────────────────────────┘
```

## src/main/index.ts
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
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/loading.html'));
  mainWindow.show();

  n8nManager = new N8nManager({
    userDataPath: app.getPath('userData'),
    onLog: (log) => mainWindow?.webContents.send('n8n-log', log),
    onReady: (url) => {
      mainWindow?.webContents.send('n8n-ready', url);
      mainWindow?.loadURL(url);
    },
    onError: (error) => mainWindow?.webContents.send('n8n-error', error),
  });

  await n8nManager.start();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  await n8nManager?.stop();
  app.quit();
});

ipcMain.handle('restart-n8n', async () => {
  await n8nManager?.restart();
});
```

## src/main/n8n-manager.ts
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
  private port = 5678;
  private isReady = false;

  constructor(options: N8nManagerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    this.port = await findAvailablePort(5678);
    const n8nBinPath = require.resolve('n8n/bin/n8n');
    // n8nは内部的にN8N_USER_FOLDER/.n8nを作成するため、
    // userDataPathをそのまま設定する
    const n8nUserFolder = this.options.userDataPath;

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
      if (!this.isReady && (log.includes('Editor is now accessible via:') ||
          log.includes(`localhost:${this.port}`))) {
        this.isReady = true;
        this.options.onReady(`http://127.0.0.1:${this.port}`);
      }
    });

    this.process.stderr?.on('data', (data) => this.options.onLog(`[stderr] ${data}`));

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
    if (!this.process) return;
    this.process.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
    }
    this.process = null;
    this.isReady = false;
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

## src/main/port-finder.ts
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

## src/main/preload.ts
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
