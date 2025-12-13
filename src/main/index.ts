import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { N8nManager } from './n8n-manager';

// Enable remote debugging for MCP tools
app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow: BrowserWindow | null = null;
let n8nManager: N8nManager | null = null;

/**
 * メインウィンドウを作成
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // ローディング画面を表示
  const loadingPath = join(__dirname, '../renderer/loading.html');
  mainWindow.loadFile(loadingPath);

  // 開発時はDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // ウィンドウが閉じられたときの処理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * n8n マネージャーを初期化して起動
 */
async function startN8n(): Promise<void> {
  n8nManager = new N8nManager({
    onLog: (message: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('n8n-log', message);
      }
    },
    onReady: (url: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('n8n-ready', url);
        // n8n の UI をロード
        mainWindow.loadURL(url);
      }
    },
    onError: (error: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('n8n-error', error);
      }
    },
  });

  try {
    await n8nManager.start();
  } catch (error) {
    console.error('Failed to start n8n:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'n8n-error',
        error instanceof Error ? error.message : 'Failed to start n8n'
      );
    }
  }
}

/**
 * アプリケーション起動時の処理
 */
app.whenReady().then(() => {
  createWindow();
  startN8n();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * すべてのウィンドウが閉じられたときの処理
 */
app.on('window-all-closed', async () => {
  // n8n プロセスを停止
  if (n8nManager) {
    await n8nManager.stop();
  }

  // macOS 以外ではアプリを終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * アプリケーション終了前の処理
 */
app.on('before-quit', async (event) => {
  if (n8nManager && n8nManager.isRunning()) {
    event.preventDefault();
    await n8nManager.stop();
    app.quit();
  }
});

/**
 * IPC ハンドラー: n8n 再起動
 */
ipcMain.handle('restart-n8n', async () => {
  if (n8nManager) {
    try {
      await n8nManager.restart();
    } catch (error) {
      console.error('Failed to restart n8n:', error);
      throw error;
    }
  }
});
