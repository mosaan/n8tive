#!/usr/bin/env node

/**
 * prepare-n8n.js
 * n8nとその依存関係をn8n-distディレクトリにインストールし、
 * tarアーカイブを作成する準備スクリプト
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const n8nDistDir = path.join(projectRoot, 'n8n-dist');
const markerFile = path.join(projectRoot, '.n8n-prepared');
const tarFile = path.join(projectRoot, 'n8n-dist.tar');

console.log('[prepare-n8n] Starting n8n preparation...');

// マーカーファイルとtarファイルが両方存在する場合はスキップ
if (fs.existsSync(markerFile) && fs.existsSync(tarFile)) {
  console.log('[prepare-n8n] n8n already prepared (marker and tar exist). Skipping...');
  process.exit(0);
}

// n8n-distディレクトリが存在しない場合は作成
if (!fs.existsSync(n8nDistDir)) {
  console.log('[prepare-n8n] Creating n8n-dist directory...');
  fs.mkdirSync(n8nDistDir, { recursive: true });
}

// package.jsonを作成（n8nのみを依存関係として含める）
const packageJson = {
  name: 'n8n-dist',
  version: '1.0.0',
  private: true,
  dependencies: {
    n8n: require('../package.json').dependencies.n8n
  }
};

const packageJsonPath = path.join(n8nDistDir, 'package.json');
console.log('[prepare-n8n] Writing package.json...');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// npm installを実行（pnpmのロックファイル問題を回避）
console.log('[prepare-n8n] Installing n8n and dependencies...');
console.log('[prepare-n8n] This may take several minutes...');

try {
  execSync('npm install --omit=dev --no-optional', {
    cwd: n8nDistDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('[prepare-n8n] Failed to install n8n:', error.message);
  process.exit(1);
}

// tarアーカイブを作成
console.log('[prepare-n8n] Building tar archive...');
try {
  execSync('node scripts/build-n8n-tar.js', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('[prepare-n8n] Failed to build tar:', error.message);
  process.exit(1);
}

// マーカーファイルを作成
console.log('[prepare-n8n] Creating marker file...');
fs.writeFileSync(markerFile, new Date().toISOString());

console.log('[prepare-n8n] n8n preparation completed successfully!');
console.log(`[prepare-n8n] n8n-dist size: ${getSizeInMB(n8nDistDir)} MB`);
console.log(`[prepare-n8n] tar file size: ${getSizeInMB(tarFile)} MB`);

function getSizeInMB(pathToCheck) {
  if (!fs.existsSync(pathToCheck)) return '0';

  const stats = fs.statSync(pathToCheck);
  if (stats.isFile()) {
    return (stats.size / (1024 * 1024)).toFixed(2);
  } else if (stats.isDirectory()) {
    let totalSize = 0;
    const files = getAllFiles(pathToCheck);
    files.forEach(file => {
      totalSize += fs.statSync(file).size;
    });
    return (totalSize / (1024 * 1024)).toFixed(2);
  }
  return '0';
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}
