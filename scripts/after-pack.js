#!/usr/bin/env node

/**
 * after-pack.js
 * electron-builder の afterPack hook
 * パッケージング後に n8n_modules を node_modules にリネームバック
 */

const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir } = context;

  console.log('[after-pack] Running afterPack hook...');
  console.log('[after-pack] App output directory:', appOutDir);

  // resources/n8n-dist/n8n_modules のパス
  const resourcesDir = path.join(appOutDir, 'resources');
  const n8nDistDir = path.join(resourcesDir, 'n8n-dist');
  const n8nModulesPath = path.join(n8nDistDir, 'n8n_modules');
  const nodeModulesPath = path.join(n8nDistDir, 'node_modules');

  // n8n_modules が存在するか確認
  if (!fs.existsSync(n8nModulesPath)) {
    console.log('[after-pack] n8n_modules not found, skipping rename.');
    return;
  }

  // node_modules が既に存在する場合は削除（念のため）
  if (fs.existsSync(nodeModulesPath)) {
    console.log('[after-pack] Removing existing node_modules...');
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
  }

  // n8n_modules を node_modules にリネーム
  console.log('[after-pack] Renaming n8n_modules to node_modules...');
  fs.renameSync(n8nModulesPath, nodeModulesPath);
  console.log('[after-pack] Rename completed successfully!');
};
