import { contextBridge, ipcRenderer } from 'electron';

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
  }
});

// TypeScript の型定義（グローバルスコープ用）
declare global {
  interface Window {
    electronAPI: {
      onN8nLog: (callback: (message: string) => void) => void;
      onN8nReady: (callback: (url: string) => void) => void;
      onN8nError: (callback: (error: string) => void) => void;
      restartN8n: () => Promise<void>;
    };
  }
}
