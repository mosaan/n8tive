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
