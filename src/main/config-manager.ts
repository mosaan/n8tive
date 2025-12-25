import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';

/**
 * Proxy configuration settings
 */
export interface ProxyConfig {
  /** Whether proxy is enabled */
  enabled: boolean;
  /** Proxy server URL (e.g., http://proxy.example.com:8080) */
  server?: string;
  /** Comma-separated list of hosts to bypass proxy (e.g., localhost,127.0.0.1,*.local) */
  bypass?: string;
}

/**
 * CA Certificate configuration settings
 */
export interface CACertConfig {
  /** Whether custom CA certificate is enabled */
  enabled: boolean;
  /** Path to the CA certificate file (PEM format) */
  path?: string;
}

export interface N8tiveConfig {
  port?: number;
  /** Proxy settings for corporate network environments */
  proxy?: ProxyConfig;
  /** Custom CA certificate settings (e.g., for Zscaler) */
  caCert?: CACertConfig;
}

/**
 * 設定管理クラス
 * n8tive_config.json の読み書きを担当
 */
export class ConfigManager {
  private configPath: string;

  constructor() {
    // 設定ファイルのパスを取得
    const userDataPath = app.getPath('userData');
    this.configPath = join(userDataPath, 'n8tive_config.json');
  }

  /**
   * 設定を読み込む
   * ファイルが存在しない場合は空のオブジェクトを返す
   */
  load(): N8tiveConfig {
    try {
      if (!existsSync(this.configPath)) {
        return {};
      }

      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load config:', error);
      return {};
    }
  }

  /**
   * 設定を保存する
   */
  save(config: N8tiveConfig): void {
    try {
      const content = JSON.stringify(config, null, 2);
      writeFileSync(this.configPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * ポート設定を取得
   * 設定されていない場合は undefined を返す
   */
  getPort(): number | undefined {
    const config = this.load();
    return config.port;
  }

  /**
   * ポート設定を保存
   */
  setPort(port: number): void {
    const config = this.load();
    config.port = port;
    this.save(config);
  }

  /**
   * ポート設定をクリア（自動設定に戻す）
   */
  clearPort(): void {
    const config = this.load();
    delete config.port;
    this.save(config);
  }

  /**
   * 設定ファイルを完全に削除
   */
  reset(): void {
    try {
      if (existsSync(this.configPath)) {
        unlinkSync(this.configPath);
      }
    } catch (error) {
      console.error('Failed to reset config:', error);
      throw error;
    }
  }

  /**
   * 設定ファイルのパスを取得
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get proxy settings
   */
  getProxy(): ProxyConfig | undefined {
    const config = this.load();
    return config.proxy;
  }

  /**
   * Set proxy settings
   */
  setProxy(proxy: ProxyConfig): void {
    const config = this.load();
    config.proxy = proxy;
    this.save(config);
  }

  /**
   * Clear proxy settings
   */
  clearProxy(): void {
    const config = this.load();
    delete config.proxy;
    this.save(config);
  }

  /**
   * Get CA certificate settings
   */
  getCACert(): CACertConfig | undefined {
    const config = this.load();
    return config.caCert;
  }

  /**
   * Set CA certificate settings
   */
  setCACert(caCert: CACertConfig): void {
    const config = this.load();
    config.caCert = caCert;
    this.save(config);
  }

  /**
   * Clear CA certificate settings
   */
  clearCACert(): void {
    const config = this.load();
    delete config.caCert;
    this.save(config);
  }

  /**
   * Get all network settings (proxy + CA cert)
   */
  getNetworkSettings(): { proxy?: ProxyConfig; caCert?: CACertConfig } {
    const config = this.load();
    return {
      proxy: config.proxy,
      caCert: config.caCert,
    };
  }

  /**
   * Set all network settings at once
   */
  setNetworkSettings(settings: { proxy?: ProxyConfig; caCert?: CACertConfig }): void {
    const config = this.load();
    config.proxy = settings.proxy;
    config.caCert = settings.caCert;
    this.save(config);
  }
}
