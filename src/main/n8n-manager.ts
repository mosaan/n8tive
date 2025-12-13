import { fork, ChildProcess } from 'child_process';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { findAvailablePort } from './port-finder';
import * as tar from 'tar';

export interface N8nManagerCallbacks {
  onLog?: (message: string) => void;
  onReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export class N8nManager {
  private n8nProcess: ChildProcess | null = null;
  private port: number = 5678;
  private callbacks: N8nManagerCallbacks = {};
  private n8nInstallPath: string = '';

  constructor(callbacks: N8nManagerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * n8nがインストールされているか確認し、必要に応じてtarから展開
   */
  private async ensureN8nInstalled(): Promise<void> {
    const userDataPath = app.getPath('userData');
    const n8nDistPath = join(userDataPath, 'n8n-dist');
    const markerFile = join(userDataPath, '.n8n-installed');

    // 既にインストール済みの場合はスキップ
    if (existsSync(markerFile) && existsSync(n8nDistPath)) {
      this.callbacks.onLog?.('n8n already installed');
      this.n8nInstallPath = n8nDistPath;
      return;
    }

    this.callbacks.onLog?.('Extracting n8n from archive...');

    // tarファイルのパス（開発環境とパッケージ環境で異なる）
    const isDev = !app.isPackaged;
    const tarPath = isDev
      ? join(app.getAppPath(), 'n8n-dist.tar')
      : join(process.resourcesPath, 'n8n-dist.tar');

    if (!existsSync(tarPath)) {
      throw new Error(`n8n tar file not found at ${tarPath}`);
    }

    // 展開先ディレクトリを作成
    if (!existsSync(n8nDistPath)) {
      mkdirSync(n8nDistPath, { recursive: true });
    }

    // tarを展開
    try {
      await tar.x({
        file: tarPath,
        cwd: userDataPath,
      });

      this.callbacks.onLog?.('n8n extracted successfully');

      // マーカーファイルを作成
      writeFileSync(markerFile, new Date().toISOString());

      this.n8nInstallPath = n8nDistPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract n8n: ${errorMessage}`);
    }
  }

  /**
   * n8n プロセスを起動
   */
  async start(): Promise<void> {
    if (this.n8nProcess) {
      throw new Error('n8n is already running');
    }

    try {
      // n8nのインストールを確認・展開
      await this.ensureN8nInstalled();

      // 利用可能なポートを検索
      this.port = await findAvailablePort();
      this.callbacks.onLog?.(`Found available port: ${this.port}`);

      // n8n のユーザーデータディレクトリ
      // n8nは内部的にN8N_USER_FOLDER/.n8nを作成するため、
      // userDataPathをそのまま指定する
      const userDataPath = app.getPath('userData');
      const n8nUserFolder = userDataPath;

      // n8n CLI のパスを取得
      // 展開したn8n-distディレクトリから取得
      const n8nCliPath = join(this.n8nInstallPath, 'node_modules', 'n8n', 'bin', 'n8n');

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
