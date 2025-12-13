# n8tive ビルド・パッケージ構成

## 事前準備と目標
アプリは Electron Vite でビルドし、Electron Builder でWindows向けにパッケージングする。目指すのは、n8n を `asar` 内にバンドルしつつ、必要に応じて `asarUnpack` で展開する形で起動時間とサイズをバランスすること。

## package.json
```json
{
  "name": "n8n-desktop",
  "version": "1.0.0",
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

## ビルド戦略の変更：tarアーカイブ方式の採用

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
2. **tar アーカイブ作成**：`n8n-dist/` 全体を `n8n-dist.tar` に圧縮
3. **extraResources として配置**：tar ファイルを `extraResources` で electron-builder に渡す
4. **実行時に展開**：アプリ起動時に tar を展開して n8n を実行

### tarアーカイブ方式の利点

1. **electron-builder の依存関係コレクターを完全に回避**：tar ファイルは単一のバイナリファイルなので、`NpmNodeModulesCollector` がスキャンしない

2. **ビルド時間の短縮**：大量のファイルコピーではなく、単一ファイルのコピーのみ

3. **確実性**：依存関係ツリーの深さや循環参照に影響されない

4. **柔軟性**：実行時に展開するため、アップデート時の対応が容易

### 実装方針

以下の手順で実装：

1. **ビルドスクリプト作成**：`scripts/build-n8n-tar.js` で n8n-dist ディレクトリを tar 化
2. **準備スクリプト作成**：`scripts/prepare-n8n.js` で n8n のインストールと tar 作成を実行
3. **electron-builder.yml 更新**：
   - `files` から `node_modules/**/*` を除外
   - `extraResources` に `n8n-dist.tar` を追加
4. **実行時展開ロジック**：main プロセスで tar を展開し、展開先から n8n を起動

### 参考リンク

- [electron-builder Issue #8857 - Maximum call stack size exceeded](https://github.com/electron-userland/electron-builder/issues/8857)
- [pnpm Issue #7079 - Invalid string length](https://github.com/pnpm/pnpm/issues/7079)
- [AutomateJoy GitHub Repository](https://github.com/newcl/AutomateJoy)
