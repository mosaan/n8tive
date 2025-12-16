# n8tive ビルド・パッケージ構成

## 事前準備と目標
アプリは Electron Vite でビルドし、Electron Builder でWindows向けにパッケージングする。目指すのは、n8n を `asar` 内にバンドルしつつ、必要に応じて `asarUnpack` で展開する形で起動時間とサイズをバランスすること。

## package.json
```json
{
  "name": "n8n-desktop",
  "version": "1.0.0+n8n.2.0.2",  // Auto-generated, do not edit manually
  "description": "Desktop wrapper for n8n workflow automation",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-builder"
  },
  "dependencies": {
    "n8n": "^1.70.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.3.0",
    "typescript": "^5.0.0"
  }
}
```

## electron-builder.yml
```yaml
appId: com.local.n8n-desktop
productName: n8n Desktop
directories:
  output: release
files:
  - dist/**/*
  - node_modules/**/*
  - "!node_modules/*/{CHANGELOG.md,README.md,readme.md,test,tests,__tests__}"
asar: true
asarUnpack:
  - node_modules/n8n/**/*
  - node_modules/@n8n/**/*

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

## リソースと構成
- `resources/icon.ico` をWindows向けアイコンとして使用。
- `tsconfig.json` では `dist` 出力先、`moduleResolution`、`esModuleInterop` などを設定し、`src/main`/`src/renderer` をコンパイル対象とする。
- ビルドパイプラインは `electron-vite build` → `electron-builder` を想定し、`package` スクリプトからWindowsバイナリ（NSIS インストーラ）を生成できるようにする。

---

## ビルド戦略の最終形：ジャンクション方式

### 問題の変遷と解決策

#### 問題1：tar方式からの移行

### 背景：従来のアプローチの問題点

当初は以下のアプローチを試みました：
- `asar: true` + `asarUnpack` で n8n とその依存関係を展開
- または `asar: false` で直接 node_modules をコピー
- `files` に `node_modules/**/*` を指定して electron-builder に処理させる

しかし、以下の致命的な問題が発生：

1. **pnpm list エラー**：electron-builder が依存関係を収集するために `pnpm list --prod --json --depth Infinity` を実行するが、n8n の巨大な依存関係ツリーで JSON 出力が JavaScript の文字列長上限を超える（"Invalid string length" エラー）

2. **スタックオーバーフロー**：electron-builder の `NpmNodeModulesCollector` が再帰的に依存関係を収集する際、n8n の深い依存関係ツリーでスタックオーバーフローが発生（"Maximum call stack size exceeded" エラー）

3. **ビルド時間**：仮に成功しても、大量のファイルコピーで実用的でない時間がかかる

これらは electron-builder 26.x の既知の問題であり、大規模な依存関係を持つプロジェクトでは回避策が必要です。

### 参考：AutomateJoy プロジェクト

類似プロジェクト [AutomateJoy](https://github.com/newcl/AutomateJoy) を調査した結果、以下のアプローチを発見：

1. **ビルド前**：別ディレクトリで n8n をインストール（例：`n8n-dist/`）
2. **n8n-dist ディレクトリ生成**：`npm install n8n` を別ディレクトリ（n8n-dist/）に実行
3. **extraResources として配置**：`n8n-dist/` フォルダを `extraResources` で electron-builder に渡す（展開不要、`filter` で node_modules/** と package*.json を明示）
4. **実行時参照**：メインプロセスで `resources/n8n-dist` をそのまま使用（必要に応じて `N8N_DIST_PATH` 環境変数で上書き可）

### ディレクトリ同梱方式の利点

1. **依存スキャンを回避**：n8n を dependencies から外しているため、electron-builder の依存収集に引っかからない
2. **展開処理が不要**：extraResources でコピー済みのフォルダをそのまま使えるため、起動待ち時間を削減
3. **デバッグ容易**：tar 解凍が不要で中身を直接確認できる

### 実装方針

以下の手順で実装：

1. **準備スクリプト**：`scripts/prepare-n8n.js` で n8n を n8n-dist にインストール（tar 化は行わない）
2. **electron-builder.yml 更新**：
   - `extraResources` に `n8n-dist/**` を追加
3. **実行時ロジック**：main プロセスで `resources/n8n-dist` からコピーし、`app.getPath('userCache')/n8n-dist`（または `N8N_DIST_PATH` 環境変数）に配置して起動

#### 問題2：electron-builder の node_modules 除外

**electron-builder 20.15.2 以降の制約**：`node_modules` という名前のディレクトリを `extraResources` でコピーしない仕様が判明。

参考：
- [Issue #3104: electron-builder does not copy directories named "node_modules"](https://github.com/electron-userland/electron-builder/issues/3104)
- [Issue #3905: Copy node_modules from subdirectory](https://github.com/electron-userland/electron-builder/issues/3905)

**初期解決策（リネーム方式）**：
- prepare-n8n.js で `node_modules` → `n8n_modules` にリネーム
- electron-builder が `n8n_modules` をコピー
- afterPack hook で `n8n_modules` → `node_modules` に戻す

**問題点**：開発モード（`pnpm dev`）で `node_modules` が見つからない

#### 最終解決策：ジャンクション（Junction）方式 ✅

**Windows のジャンクション機能**を活用：
- ディレクトリのシンボリックリンク
- **管理者権限不要**で作成可能
- Node.js の `fs.symlinkSync(target, path, 'junction')` で作成

### 最終実装：ジャンクション方式の詳細

#### 1. prepare-n8n.js の処理フロー

```javascript
// 1. 通常通り node_modules にインストール
execSync('npm install --omit=dev --no-optional', { cwd: n8nDistDir });

// 2. node_modules を n8n_modules にリネーム
fs.renameSync(nodeModulesPath, n8nModulesPath);

// 3. n8n_modules への node_modules ジャンクションを作成
fs.symlinkSync(n8nModulesPath, nodeModulesPath, 'junction');
```

**結果のディレクトリ構造**：
```
n8n-dist/
├── n8n_modules/          ← 実体（890MB のパッケージ）
├── node_modules/         ← ジャンクション（n8n_modules へのリンク）
├── package.json
└── package-lock.json
```

#### 2. 開発時の動作

- `pnpm dev` 実行
- Node.js は `node_modules`（ジャンクション）経由で `n8n_modules` を参照
- 正常に動作 ✅

#### 3. ビルド時の動作

```yaml
# electron-builder.yml
extraResources:
  - from: n8n-dist
    to: n8n-dist
afterPack: ./scripts/after-pack.js
```

**electron-builder のコピー挙動**：
- `n8n_modules`（実体）→ **コピーされる** ✅
- `node_modules`（ジャンクション）→ **コピーされない**（リンクのみスキップ）

#### 4. afterPack hook の処理

```javascript
// scripts/after-pack.js
exports.default = async function(context) {
  const n8nModulesPath = path.join(appOutDir, 'resources', 'n8n-dist', 'n8n_modules');
  const nodeModulesPath = path.join(appOutDir, 'resources', 'n8n-dist', 'node_modules');

  // n8n_modules → node_modules にリネーム
  fs.renameSync(n8nModulesPath, nodeModulesPath);
};
```

**最終的なパッケージ構造**：
```
release/0.1.0/win-unpacked/resources/n8n-dist/
├── node_modules/          ← 実体（正常に同梱）
├── package.json
└── package-lock.json
```

### ジャンクション方式の利点

| 項目 | リネーム方式 | ジャンクション方式 |
|------|-------------|-------------------|
| 環境変数 | 必要 | **不要** ✅ |
| スクリプト数 | 2つ | **1つ** ✅ |
| リネーム回数 | 2回 | **1回**（afterPack のみ）✅ |
| 管理者権限 | 不要 | **不要** ✅ |
| 実装の複雑さ | やや複雑 | **シンプル** ✅ |

### 現在の package.json（最終版）

```json
{
  "name": "n8tive",
  "version": "0.1.0",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "prepare:n8n": "node scripts/prepare-n8n.js",
    "package": "npm run prepare:n8n && npm run build && electron-builder"
  }
}
```

### 現在の electron-builder.yml（最終版）

```yaml
appId: com.n8tive.app
productName: n8tive
directories:
  output: release/${version}
files:
  - out/**/*
extraResources:
  - from: n8n-dist
    to: n8n-dist
asar: true
afterPack: ./scripts/after-pack.js

win:
  target:
    - nsis

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
```

### バージョン管理の自動化

#### update-version.js の役割

`scripts/update-version.js` は、ビルド前に実行されるバージョン生成スクリプトです。

**処理フロー**:
1. `scripts/update-version.js` 内の `N8TIVE_VERSION` 定数を読み取る（例: `1.0.0`）
2. `n8n-version.json` から n8n バージョンを読み取る（例: `^2.0.2`）
3. セマンティックバージョニングのレンジ記号（`^`, `~` など）を除去（`2.0.2`）
4. ビルドメタデータ形式で結合: `1.0.0+n8n.2.0.2`
5. `package.json` の `version` フィールドを更新

**統合**:
- `pnpm package` の最初のステップとして自動実行
- 手動実行: `pnpm run update:version`

**バージョンアップ方法**:
- **n8n のみ**: `n8n-version.json` を編集
- **n8tive ラッパー**: `scripts/update-version.js` の `N8TIVE_VERSION` を編集
- いずれの場合も、次回の `pnpm package` で自動的に反映される

### 参考リンク

- [electron-builder Issue #8857 - Maximum call stack size exceeded](https://github.com/electron-userland/electron-builder/issues/8857)
- [pnpm Issue #7079 - Invalid string length](https://github.com/pnpm/pnpm/issues/7079)
- [electron-builder Issue #3104 - node_modules not copied](https://github.com/electron-userland/electron-builder/issues/3104)
- [electron-builder Issue #3905 - Copy node_modules from subdirectory](https://github.com/electron-userland/electron-builder/issues/3905)
- [AutomateJoy GitHub Repository](https://github.com/newcl/AutomateJoy)
- [Windows Junction Points Documentation](https://docs.microsoft.com/en-us/windows/win32/fileio/reparse-points)
