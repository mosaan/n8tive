#!/usr/bin/env node

/**
 * update-version.js
 * n8tiveのバージョン文字列を自動生成し、package.jsonを更新するスクリプト
 *
 * バージョン形式: {n8tive-version}+n8n.{n8n-version}
 * 例: 1.0.0+n8n.2.0.2
 */

const fs = require('fs');
const path = require('path');

// n8tive ラッパー自体のベースバージョン
const N8TIVE_VERSION = '1.0.0';

const projectRoot = path.join(__dirname, '..');
const n8nVersionFile = path.join(projectRoot, 'n8n-version.json');
const packageJsonPath = path.join(projectRoot, 'package.json');

console.log('[update-version] Starting version generation...');

// n8tive バージョンのバリデーション
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(N8TIVE_VERSION)) {
  console.error(`[update-version] ERROR: Invalid n8tive version format: ${N8TIVE_VERSION}`);
  console.error('[update-version] Expected format: X.Y.Z (e.g., 1.0.0)');
  process.exit(1);
}

console.log(`[update-version] Current n8tive version: ${N8TIVE_VERSION}`);

// n8n-version.json の存在確認
if (!fs.existsSync(n8nVersionFile)) {
  console.error('[update-version] ERROR: n8n-version.json not found');
  console.error(`[update-version] Expected path: ${n8nVersionFile}`);
  process.exit(1);
}

// n8n-version.json の読み取り
let n8nVersionData;
try {
  const fileContent = fs.readFileSync(n8nVersionFile, 'utf8');
  n8nVersionData = JSON.parse(fileContent);
} catch (error) {
  console.error('[update-version] ERROR: Failed to read or parse n8n-version.json');
  console.error(`[update-version] ${error.message}`);
  process.exit(1);
}

// n8n フィールドの検証
if (!n8nVersionData.n8n) {
  console.error('[update-version] ERROR: Missing "n8n" field in n8n-version.json');
  process.exit(1);
}

const n8nVersionRaw = n8nVersionData.n8n;
console.log(`[update-version] Current n8n version: ${n8nVersionRaw}`);

// セマンティックバージョニングの範囲記号を除去
// 対応: ^, ~, >=, <=, >, <, =
const n8nVersion = n8nVersionRaw.replace(/^[\^~>=<]+/, '');

// n8n バージョンのバリデーション（基本的な形式チェック）
// セマンティックバージョニングは X.Y.Z または X.Y.Z-prerelease を許可
const n8nSemverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
if (!n8nSemverRegex.test(n8nVersion)) {
  console.error(`[update-version] ERROR: Invalid n8n version format: ${n8nVersion}`);
  console.error('[update-version] Expected format: X.Y.Z or X.Y.Z-prerelease (e.g., 2.0.2 or 2.0.2-beta.1)');
  process.exit(1);
}

if (n8nVersionRaw !== n8nVersion) {
  console.log(`[update-version] Stripped n8n version: ${n8nVersionRaw} → ${n8nVersion}`);
}

// フルバージョン文字列の構築
const fullVersion = `${N8TIVE_VERSION}+n8n.${n8nVersion}`;
console.log(`[update-version] Generated version: ${fullVersion}`);

// package.json の読み取り
let packageJson;
try {
  const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson = JSON.parse(packageContent);
} catch (error) {
  console.error('[update-version] ERROR: Failed to read or parse package.json');
  console.error(`[update-version] ${error.message}`);
  process.exit(1);
}

// バージョンフィールドの更新
const oldVersion = packageJson.version;
packageJson.version = fullVersion;

// package.json の書き込み（2スペースインデント、末尾に改行）
try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log('[update-version] Updated package.json successfully');
  console.log(`[update-version] Version changed: ${oldVersion} → ${fullVersion}`);
} catch (error) {
  console.error('[update-version] ERROR: Failed to write package.json');
  console.error(`[update-version] ${error.message}`);
  process.exit(1);
}

console.log('[update-version] Version generation completed successfully!');
