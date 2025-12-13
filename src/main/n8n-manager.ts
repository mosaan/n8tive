import { fork, ChildProcess } from 'child_process';
import { app } from 'electron';
import { join } from 'path';
import { findAvailablePort } from './port-finder';

export interface N8nManagerCallbacks {
  onLog?: (message: string) => void;
  onReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export class N8nManager {
  private n8nProcess: ChildProcess | null = null;
  private port: number = 5678;
  private callbacks: N8nManagerCallbacks = {};

  constructor(callbacks: N8nManagerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * n8n プロセスを起動
   */
  async start(): Promise<void> {
    if (this.n8nProcess) {
      throw new Error('n8n is already running');
    }

    try {
      // 利用可能なポートを検索
      this.port = await findAvailablePort();
      this.callbacks.onLog?.(`Found available port: ${this.port}`);

      // n8n のユーザーデータディレクトリ
      // n8nは内部的にN8N_USER_FOLDER/.n8nを作成するため、
      // userDataPathをそのまま指定する
      const userDataPath = app.getPath('userData');
      const n8nUserFolder = userDataPath;

      // n8n CLI のパスを取得
      // require.resolve('n8n')でパッケージのルートを見つけて、bin/n8nを指定
      const n8nPackagePath = require.resolve('n8n/package.json');
      const n8nCliPath = join(n8nPackagePath, '..', 'bin', 'n8n');

      this.callbacks.onLog?.('Starting n8n...');

      // n8n プロセスを起動
      this.n8nProcess = fork(n8nCliPath, ['start'], {
        env: {
          ...process.env,
          N8N_PORT: this.port.toString(),
          N8N_HOST: '127.0.0.1',
          N8N_USER_FOLDER: n8nUserFolder,
          N8N_PROTOCOL: 'http',
          N8N_LOG_LEVEL: 'info',
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });

      // 標準出力を監視
      this.n8nProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        this.callbacks.onLog?.(message);

        // n8n が起動完了したかチェック
        if (message.includes('Editor is now accessible via')) {
          const url = `http://127.0.0.1:${this.port}`;
          this.callbacks.onReady?.(url);
        }
      });

      // 標準エラーを監視
      this.n8nProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        this.callbacks.onLog?.(`[ERROR] ${message}`);
        this.callbacks.onError?.(message);
      });

      // プロセス終了を監視
      this.n8nProcess.on('exit', (code, signal) => {
        this.callbacks.onLog?.(
          `n8n process exited with code ${code} and signal ${signal}`
        );
        this.n8nProcess = null;
      });

      // エラーを監視
      this.n8nProcess.on('error', (error) => {
        this.callbacks.onLog?.(`Failed to start n8n: ${error.message}`);
        this.callbacks.onError?.(error.message);
        this.n8nProcess = null;
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onLog?.(`Error starting n8n: ${errorMessage}`);
      this.callbacks.onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * n8n プロセスを停止
   */
  async stop(): Promise<void> {
    if (!this.n8nProcess) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.n8nProcess) {
        resolve();
        return;
      }

      this.n8nProcess.once('exit', () => {
        this.n8nProcess = null;
        resolve();
      });

      // プロセスを終了
      this.n8nProcess.kill('SIGTERM');

      // 5秒後に強制終了
      setTimeout(() => {
        if (this.n8nProcess) {
          this.n8nProcess.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * n8n プロセスを再起動
   */
  async restart(): Promise<void> {
    this.callbacks.onLog?.('Restarting n8n...');
    await this.stop();
    await this.start();
  }

  /**
   * n8n が実行中かどうか
   */
  isRunning(): boolean {
    return this.n8nProcess !== null;
  }

  /**
   * 現在使用中のポート番号を取得
   */
  getPort(): number {
    return this.port;
  }
}
