import { createServer } from 'net';

/**
 * 指定されたポートが利用可能かどうかをチェック
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * 利用可能なポートを検索
 * @param startPort 開始ポート番号（デフォルト: 5678）
 * @param maxAttempts 最大試行回数（デフォルト: 100）
 * @returns 利用可能なポート番号
 */
export async function findAvailablePort(
  startPort: number = 5678,
  maxAttempts: number = 100
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const isAvailable = await checkPort(port);

    if (isAvailable) {
      return port;
    }
  }

  throw new Error(
    `No available port found in range ${startPort}-${startPort + maxAttempts - 1}`
  );
}
