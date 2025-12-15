#!/usr/bin/env node

/**
 * prepare-n8n.js
 * n8nとその依存関係をn8n-distディレクトリにインストールする準備スクリプト
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const n8nVersionFile = path.join(projectRoot, 'n8n-version.json');
const n8nDistDir = path.join(projectRoot, 'n8n-dist');
const markerFile = path.join(projectRoot, '.n8n-prepared');

console.log('[prepare-n8n] Starting n8n preparation...');
// マーカーファイルが存在する場合はスキップ
if (fs.existsSync(markerFile)) {
  console.log('[prepare-n8n] n8n already prepared (marker exists). Skipping...');
  process.exit(0);
}

// n8n-distディレクトリが存在しない場合は作成
if (!fs.existsSync(n8nDistDir)) {
  console.log('[prepare-n8n] Creating n8n-dist directory...');
  fs.mkdirSync(n8nDistDir, { recursive: true });
}

// n8nのバージョンを取得（環境変数優先、なければファイル）
const n8nVersion = (() => {
  if (process.env.N8N_VERSION) return process.env.N8N_VERSION;

  if (!fs.existsSync(n8nVersionFile)) {
    console.error('[prepare-n8n] n8n-version.json not found and N8N_VERSION env not set.');
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(n8nVersionFile, 'utf8'));
    if (!parsed.n8n) throw new Error('Missing "n8n" field');
    return parsed.n8n;
  } catch (err) {
    console.error(`[prepare-n8n] Failed to read n8n version: ${err.message}`);
    process.exit(1);
  }
})();
console.log(`[prepare-n8n] Using n8n version: ${n8nVersion}`);

// package.jsonを作成（n8nのみを依存関係として含める）
const packageJson = {
  name: 'n8n-dist',
  version: '1.0.0',
  private: true,
  dependencies: {
    n8n: n8nVersion
  }
};

const packageJsonPath = path.join(n8nDistDir, 'package.json');
console.log('[prepare-n8n] Writing package.json...');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// npm installを実行（通常通り node_modules にインストール）
console.log('[prepare-n8n] Installing n8n and dependencies...');
console.log('[prepare-n8n] This may take several minutes...');

const nodeModulesPath = path.join(n8nDistDir, 'node_modules');
const n8nModulesPath = path.join(n8nDistDir, 'n8n_modules');

try {
  execSync('npm install --omit=dev --no-optional', {
    cwd: n8nDistDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('[prepare-n8n] Failed to install n8n:', error.message);
  process.exit(1);
}

// node_modules を n8n_modules にリネーム
console.log('[prepare-n8n] Renaming node_modules to n8n_modules...');
if (fs.existsSync(n8nModulesPath)) {
  fs.rmSync(n8nModulesPath, { recursive: true, force: true });
}
fs.renameSync(nodeModulesPath, n8nModulesPath);

// n8n_modules への node_modules ジャンクションを作成
console.log('[prepare-n8n] Creating junction: node_modules -> n8n_modules...');
try {
  fs.symlinkSync(n8nModulesPath, nodeModulesPath, 'junction');
  console.log('[prepare-n8n] Junction created successfully.');
} catch (error) {
  console.error('[prepare-n8n] Failed to create junction:', error.message);
  console.error('[prepare-n8n] This may require running as administrator on older Windows versions.');
  process.exit(1);
}

// マーカーファイルを作成
console.log('[prepare-n8n] Creating marker file...');
fs.writeFileSync(markerFile, new Date().toISOString());

console.log('[prepare-n8n] n8n preparation completed successfully!');
// n8n_modules（実体）のサイズを表示
console.log(`[prepare-n8n] n8n_modules size: ${getSizeInMB(n8nModulesPath)} MB`);

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
    const stats = fs.lstatSync(filePath); // シンボリックリンクを追跡しない

    // シンボリックリンク/ジャンクションはスキップ
    if (stats.isSymbolicLink()) {
      return;
    }

    if (stats.isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}
