import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } from 'electron';
import { join } from 'path';
import { N8nManager } from './n8n-manager';
import { ConfigManager, ProxyConfig, CACertConfig } from './config-manager';

// Enable remote debugging for MCP tools
app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow: BrowserWindow | null = null;
let n8nManager: N8nManager | null = null;
let tray: Tray | null = null;
let configManager: ConfigManager | null = null;
let isQuitting = false;

/**
 * Create main window
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

  // Show loading screen
  const loadingPath = join(__dirname, '../renderer/loading.html');
  mainWindow.loadFile(loadingPath);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close event
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
 * Create system tray
 */
function createTray(): void {
  // Get tray icon path
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.ico')
    : join(__dirname, '../../resources/tray-icon.ico');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  tray.setToolTip('n8tive - n8n Desktop Wrapper');

  // Create tray menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
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
      label: 'Settings',
      submenu: [
        {
          label: 'Port Settings...',
          click: () => {
            showPortSettingsDialog();
          },
        },
        {
          label: 'Network Settings...',
          click: () => {
            showNetworkSettingsDialog();
          },
        },
        {
          type: 'separator',
        },
        {
          label: 'Reset Port to Auto',
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
      label: 'View Logs...',
      click: async () => {
        try {
          await openLogFolder();
        } catch (error) {
          dialog.showErrorBox(
            'Error',
            error instanceof Error ? error.message : 'Failed to open log folder'
          );
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Exit',
      click: async () => {
        await quitApp();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Handle tray icon click
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
 * Create application menu bar
 */
function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          submenu: [
            {
              label: 'Port Settings...',
              click: () => {
                showPortSettingsDialog();
              },
            },
            {
              label: 'Network Settings...',
              click: () => {
                showNetworkSettingsDialog();
              },
            },
            {
              type: 'separator',
            },
            {
              label: 'Reset Port to Auto',
              click: () => {
                resetPortSettings();
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: async () => {
            await quitApp();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (_item, focusedWindow) => {
            if (focusedWindow && 'reload' in focusedWindow) {
              (focusedWindow as BrowserWindow).reload();
            }
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: (_item, focusedWindow) => {
            if (focusedWindow && 'webContents' in focusedWindow) {
              (focusedWindow as BrowserWindow).webContents.toggleDevTools();
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'View Logs...',
          click: async () => {
            try {
              await openLogFolder();
            } catch (error) {
              dialog.showErrorBox(
                'Error',
                error instanceof Error ? error.message : 'Failed to open log folder'
              );
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About n8tive',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About n8tive',
              message: 'n8tive - n8n Desktop Wrapper',
              detail: `Version: ${app.getVersion()}\n\nA desktop application wrapper for n8n workflow automation.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Show port settings dialog
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

  // Different paths for development and build modes
  if (process.env.NODE_ENV === 'development') {
    // Load from dev server in development mode
    settingsWindow.loadURL('http://localhost:5173/port-settings.html');
  } else {
    // Load from file in build mode
    const settingsPath = join(__dirname, '../renderer/port-settings.html');
    settingsWindow.loadFile(settingsPath);
  }

  // Hide window menu
  settingsWindow.setMenu(null);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    settingsWindow.webContents.openDevTools();
  }
}

/**
 * Show network settings dialog
 */
function showNetworkSettingsDialog(): void {
  const networkWindow = new BrowserWindow({
    width: 500,
    height: 520,
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

  // Different paths for development and build modes
  if (process.env.NODE_ENV === 'development') {
    // Load from dev server in development mode
    networkWindow.loadURL('http://localhost:5173/network-settings.html');
  } else {
    // Load from file in build mode
    const networkPath = join(__dirname, '../renderer/network-settings.html');
    networkWindow.loadFile(networkPath);
  }

  // Hide window menu
  networkWindow.setMenu(null);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    networkWindow.webContents.openDevTools();
  }
}

/**
 * Configure Electron session proxy based on settings
 * This applies proxy settings to the BrowserWindow that displays n8n Editor
 */
async function configureSessionProxy(): Promise<void> {
  if (!configManager || !mainWindow) {
    return;
  }

  const proxyConfig = configManager.getProxy();
  
  if (proxyConfig?.enabled && proxyConfig.server) {
    try {
      // Configure proxy for the main window session
      await mainWindow.webContents.session.setProxy({
        proxyRules: proxyConfig.server,
        proxyBypassRules: `localhost,127.0.0.1${proxyConfig.bypass ? ',' + proxyConfig.bypass : ''}`,
      });
      console.log('Session proxy configured:', proxyConfig.server);
    } catch (error) {
      console.error('Failed to configure session proxy:', error);
    }
  } else {
    // Clear proxy settings (use direct connection)
    try {
      await mainWindow.webContents.session.setProxy({
        mode: 'direct',
      });
      console.log('Session proxy cleared (direct connection)');
    } catch (error) {
      console.error('Failed to clear session proxy:', error);
    }
  }
}

/**
 * Quit app (stop n8n process before quitting)
 */
async function quitApp(): Promise<void> {
  if (isQuitting) {
    return;
  }

  isQuitting = true;

  // Stop n8n process
  if (n8nManager && n8nManager.isRunning()) {
    try {
      console.log('Stopping n8n before quit...');
      await n8nManager.stop();
      console.log('n8n stopped successfully');
    } catch (error) {
      console.error('Failed to stop n8n:', error);
    }
  }

  // Quit app
  app.quit();
}

/**
 * Open the log folder in the OS file explorer
 */
async function openLogFolder(): Promise<void> {
  if (!n8nManager) {
    throw new Error('n8n manager is not initialized');
  }

  const logDir = n8nManager.getLogDirectory();

  // Check if directory exists
  const { existsSync } = require('fs');
  if (!existsSync(logDir)) {
    throw new Error('Log directory does not exist yet. Logs will be created when n8n starts.');
  }

  // Open the folder in the default file explorer
  const result = await shell.openPath(logDir);

  // shell.openPath returns empty string on success, error message on failure
  if (result) {
    throw new Error(`Failed to open log folder: ${result}`);
  }
}

/**
 * Reset port settings
 */
async function resetPortSettings(): Promise<void> {
  if (!configManager || !n8nManager) {
    return;
  }

  // Show confirmation dialog
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Cancel', 'Reset & Restart'],
    defaultId: 1,
    title: 'Reset Port Settings',
    message: 'Reset port settings to automatic detection?',
    detail: 'n8n will restart and automatically search for an available port.',
  });

  if (result.response === 1) {
    try {
      // Clear port setting
      configManager.clearPort();

      // Also clear preferredPort
      n8nManager.setPreferredPort(undefined);

      // Restart n8n
      await n8nManager.restart();

      console.log('Port settings reset to auto');
    } catch (error) {
      console.error('Failed to reset port settings:', error);
      dialog.showErrorBox(
        'Error',
        'Failed to reset port settings: ' +
        (error instanceof Error ? error.message : 'Unknown error')
      );
    }
  }
}

/**
 * Initialize and start n8n manager
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
        // Load n8n UI
        mainWindow.loadURL(url);
      }
    },
    onError: (error: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('n8n-error', error);
      }
    },
  });

  // Load and set configured port number
  if (configManager) {
    const preferredPort = configManager.getPort();
    if (preferredPort !== undefined) {
      n8nManager.setPreferredPort(preferredPort);
    }

    // Load and set network settings (proxy and CA certificate)
    const networkSettings = configManager.getNetworkSettings();
    n8nManager.setNetworkSettings(networkSettings);
  }

  try {
    // Configure Electron session proxy before starting n8n
    await configureSessionProxy();
    
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
 * Application startup handling
 */
app.whenReady().then(() => {
  // Initialize ConfigManager
  configManager = new ConfigManager();

  // Create window and tray
  createWindow();
  createTray();
  createAppMenu();

  // Start n8n
  startN8n();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Handle all windows closed
 */
app.on('window-all-closed', () => {
  // Tray resident mode, so app doesn't quit when windows close
  // Remains in tray even on non-macOS platforms
});

/**
 * Handle before quit
 */
app.on('before-quit', async (event) => {
  // If n8n not stopped yet
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

/**
 * IPC Handler: Open log folder in file explorer
 */
ipcMain.handle('open-log-folder', async () => {
  if (n8nManager) {
    const logDir = n8nManager.getLogDirectory();

    // Check if directory exists before opening
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
      throw new Error('Log directory does not exist yet. Logs will be created when n8n starts.');
    }

    // Open the folder in the default file explorer
    const result = await shell.openPath(logDir);

    // shell.openPath returns empty string on success, error message on failure
    if (result) {
      throw new Error(`Failed to open log folder: ${result}`);
    }
  } else {
    throw new Error('n8n manager is not initialized');
  }
});

/**
 * IPC Handler: Get current network settings
 */
ipcMain.handle('get-network-settings', async () => {
  if (configManager) {
    return configManager.getNetworkSettings();
  }
  return { proxy: undefined, caCert: undefined };
});

/**
 * IPC Handler: Save network settings and restart n8n
 */
ipcMain.handle('save-network-settings-and-restart', async (_event, settings: { proxy?: ProxyConfig; caCert?: CACertConfig }) => {
  if (configManager && n8nManager) {
    try {
      // Save network settings
      configManager.setNetworkSettings(settings);

      // Apply network settings to n8n manager
      n8nManager.setNetworkSettings(settings);

      // Configure Electron session proxy
      await configureSessionProxy();

      // Restart n8n
      await n8nManager.restart();

      // Close the settings dialog
      const windows = BrowserWindow.getAllWindows();
      const networkWindow = windows.find(w => w !== mainWindow);
      if (networkWindow) {
        networkWindow.close();
      }
    } catch (error) {
      console.error('Failed to save network settings and restart:', error);
      throw error;
    }
  }
});

/**
 * IPC Handler: Close network settings dialog
 */
ipcMain.handle('close-network-settings', async () => {
  const windows = BrowserWindow.getAllWindows();
  const networkWindow = windows.find(w => w !== mainWindow);
  if (networkWindow) {
    networkWindow.close();
  }
});

/**
 * IPC Handler: Select certificate file via dialog
 */
ipcMain.handle('select-certificate-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select CA Certificate File',
    properties: ['openFile'],
    filters: [
      { name: 'Certificate Files', extensions: ['pem', 'crt', 'cer'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});
