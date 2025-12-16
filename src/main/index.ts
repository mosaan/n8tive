import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import { join } from 'path';
import { N8nManager } from './n8n-manager';
import { ConfigManager } from './config-manager';

// Enable remote debugging for MCP tools
app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow: BrowserWindow | null = null;
let n8nManager: N8nManager | null = null;
let tray: Tray | null = null;
let configManager: ConfigManager | null = null;
let isQuitting = false;

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
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * システムトレイを作成
 */
function createTray(): void {
  // トレイアイコンのパスを取得
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.ico')
    : join(__dirname, '../../resources/tray-icon.ico');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  tray.setToolTip('n8tive - n8n Desktop Wrapper');

  // トレイメニューを作成
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開く',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: '設定',
      submenu: [
        {
          label: 'ポート設定...',
          click: () => {
            showPortSettingsDialog();
          },
        },
        {
          label: '自動設定に戻す',
          click: () => {
            resetPortSettings();
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: '終了',
      click: async () => {
        await quitApp();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // トレイアイコンをクリックしたときの処理
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * ポート設定ダイアログを表示
 */
function showPortSettingsDialog(): void {
  const settingsWindow = new BrowserWindow({
    width: 450,
    height: 240,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: true,
    parent: mainWindow || undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 開発モードとビルドモードで異なるパス
  if (process.env.NODE_ENV === 'development') {
    // 開発モードではdevサーバーからロード
    settingsWindow.loadURL('http://localhost:5173/port-settings.html');
  } else {
    // ビルドモードではファイルからロード
    const settingsPath = join(__dirname, '../renderer/port-settings.html');
    settingsWindow.loadFile(settingsPath);
  }

  // ウィンドウメニューを非表示
  settingsWindow.setMenu(null);

  // 開発時はDevToolsを開く
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.webContents.openDevTools();
  }
}

/**
 * アプリを終了（n8nプロセスを停止してから終了）
 */
async function quitApp(): Promise<void> {
  if (isQuitting) {
    return;
  }

  isQuitting = true;

  // n8nプロセスを停止
  if (n8nManager && n8nManager.isRunning()) {
    try {
      console.log('Stopping n8n before quit...');
      await n8nManager.stop();
      console.log('n8n stopped successfully');
    } catch (error) {
      console.error('Failed to stop n8n:', error);
    }
  }

  // アプリを終了
  app.quit();
}

/**
 * ポート設定をリセット
 */
async function resetPortSettings(): Promise<void> {
  if (!configManager || !n8nManager) {
    return;
  }

  // 確認ダイアログを表示
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['キャンセル', '自動設定に戻して再起動'],
    defaultId: 1,
    title: 'ポート設定をリセット',
    message: 'ポート設定を自動設定に戻しますか?',
    detail: 'n8nが再起動され、利用可能なポートが自動的に検索されます。',
  });

  if (result.response === 1) {
    try {
      // ポート設定をクリア
      configManager.clearPort();

      // preferredPortもクリア
      n8nManager.setPreferredPort(undefined);

      // n8nを再起動
      await n8nManager.restart();

      console.log('Port settings reset to auto');
    } catch (error) {
      console.error('Failed to reset port settings:', error);
      dialog.showErrorBox(
        'エラー',
        'ポート設定のリセットに失敗しました: ' +
        (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }
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

  // 設定されたポート番号を読み込んで設定
  if (configManager) {
    const preferredPort = configManager.getPort();
    if (preferredPort !== undefined) {
      n8nManager.setPreferredPort(preferredPort);
    }
  }

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
  // ConfigManagerを初期化
  configManager = new ConfigManager();

  // ウィンドウとトレイを作成
  createWindow();
  createTray();

  // n8nを起動
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
app.on('window-all-closed', () => {
  // トレイ常駐モードなので、ウィンドウが閉じられてもアプリは終了しない
  // macOS 以外でもトレイに残る
});

/**
 * アプリケーション終了前の処理
 */
app.on('before-quit', async (event) => {
  // まだn8nを停止していない場合
  if (!isQuitting && n8nManager && n8nManager.isRunning()) {
    event.preventDefault();
    await quitApp();
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

/**
 * IPC ハンドラー: 現在のポート設定を取得
 */
ipcMain.handle('get-current-port', async () => {
  if (configManager) {
    return configManager.getPort();
  }
  return undefined;
});

/**
 * IPC ハンドラー: ポート設定を保存して再起動
 */
ipcMain.handle('save-port-and-restart', async (_event, port: number) => {
  if (configManager && n8nManager) {
    try {
      // ポート設定を保存
      configManager.setPort(port);

      // 新しいポート設定を適用
      n8nManager.setPreferredPort(port);

      // n8nを再起動
      await n8nManager.restart();

      // ダイアログを閉じる
      const windows = BrowserWindow.getAllWindows();
      const settingsWindow = windows.find(w => w !== mainWindow);
      if (settingsWindow) {
        settingsWindow.close();
      }
    } catch (error) {
      console.error('Failed to save port and restart:', error);
      throw error;
    }
  }
});

/**
 * IPC ハンドラー: ポート設定ダイアログを閉じる
 */
ipcMain.handle('close-port-settings', async () => {
  const windows = BrowserWindow.getAllWindows();
  const settingsWindow = windows.find(w => w !== mainWindow);
  if (settingsWindow) {
    settingsWindow.close();
  }
});
