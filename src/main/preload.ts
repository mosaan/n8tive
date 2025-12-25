import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for network settings
interface ProxyConfig {
  enabled: boolean;
  server?: string;
  bypass?: string;
}

interface CACertConfig {
  enabled: boolean;
  path?: string;
}

interface NetworkSettings {
  proxy?: ProxyConfig;
  caCert?: CACertConfig;
}

// Renderer プロセスに公開する安全な API
contextBridge.exposeInMainWorld('electronAPI', {
  // n8n のログメッセージを受信
  onN8nLog: (callback: (message: string) => void) => {
    ipcRenderer.on('n8n-log', (_event, message: string) => callback(message));
  },

  // n8n の準備完了イベントを受信
  onN8nReady: (callback: (url: string) => void) => {
    ipcRenderer.on('n8n-ready', (_event, url: string) => callback(url));
  },

  // n8n のエラーイベントを受信
  onN8nError: (callback: (error: string) => void) => {
    ipcRenderer.on('n8n-error', (_event, error: string) => callback(error));
  },

  // n8n の再起動をリクエスト
  restartN8n: () => {
    return ipcRenderer.invoke('restart-n8n');
  },

  // 現在のポート設定を取得
  getCurrentPort: () => {
    return ipcRenderer.invoke('get-current-port');
  },

  // ポート設定を保存して再起動
  savePortAndRestart: (port: number) => {
    return ipcRenderer.invoke('save-port-and-restart', port);
  },

  // ポート設定ダイアログを閉じる
  closePortSettings: () => {
    return ipcRenderer.invoke('close-port-settings');
  },

  // Open log folder in file explorer
  openLogFolder: () => {
    return ipcRenderer.invoke('open-log-folder');
  },

  // Get current network settings (proxy and CA certificate)
  getNetworkSettings: (): Promise<NetworkSettings> => {
    return ipcRenderer.invoke('get-network-settings');
  },

  // Save network settings and restart n8n
  saveNetworkSettingsAndRestart: (settings: NetworkSettings): Promise<void> => {
    return ipcRenderer.invoke('save-network-settings-and-restart', settings);
  },

  // Close network settings dialog
  closeNetworkSettings: () => {
    return ipcRenderer.invoke('close-network-settings');
  },

  // Open file dialog to select certificate file
  selectCertificateFile: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-certificate-file');
  },
});

// TypeScript の型定義（グローバルスコープ用）
declare global {
  interface Window {
    electronAPI: {
      onN8nLog: (callback: (message: string) => void) => void;
      onN8nReady: (callback: (url: string) => void) => void;
      onN8nError: (callback: (error: string) => void) => void;
      restartN8n: () => Promise<void>;
      getCurrentPort: () => Promise<number | undefined>;
      savePortAndRestart: (port: number) => Promise<void>;
      closePortSettings: () => Promise<void>;
      openLogFolder: () => Promise<void>;
      getNetworkSettings: () => Promise<NetworkSettings>;
      saveNetworkSettingsAndRestart: (settings: NetworkSettings) => Promise<void>;
      closeNetworkSettings: () => Promise<void>;
      selectCertificateFile: () => Promise<string | null>;
    };
  }
}
