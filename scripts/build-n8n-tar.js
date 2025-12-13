#!/usr/bin/env node

/**
 * build-n8n-tar.js
 * n8n-distディレクトリをtarアーカイブに圧縮する
 */

const fs = require('fs');
const path = require('path');
const tar = require('tar');

const projectRoot = path.join(__dirname, '..');
const n8nDistDir = path.join(projectRoot, 'n8n-dist');
const outputTar = path.join(projectRoot, 'n8n-dist.tar');

console.log('[build-n8n-tar] Building tar archive...');
console.log(`[build-n8n-tar] Source: ${n8nDistDir}`);
console.log(`[build-n8n-tar] Output: ${outputTar}`);

// n8n-distディレクトリが存在するか確認
if (!fs.existsSync(n8nDistDir)) {
  console.error('[build-n8n-tar] Error: n8n-dist directory does not exist!');
  console.error('[build-n8n-tar] Please run prepare-n8n.js first.');
  process.exit(1);
}

// 既存のtarファイルを削除
if (fs.existsSync(outputTar)) {
  console.log('[build-n8n-tar] Removing existing tar file...');
  fs.unlinkSync(outputTar);
}

// tarアーカイブを作成
(async () => {
  try {
    await tar.c(
      {
        gzip: false,
        file: outputTar,
        cwd: path.dirname(n8nDistDir)
      },
      [path.basename(n8nDistDir)]
    );

    const stats = fs.statSync(outputTar);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[build-n8n-tar] Successfully created tar archive (${sizeMB} MB)`);
  } catch (err) {
    console.error('[build-n8n-tar] Error creating tar:', err.message);
    process.exit(1);
  }
})();
