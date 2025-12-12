# n8tive (n8n Desktop Wrapper project) - プロジェクト概要

## 目的
n8n をそのままの CLI 仕様で Electron 内で起動し、ローカルユーザーが Node.js やブラウザ設定を意識せずに n8n Editor にアクセスできるデスクトップラッパーの提供。

## このファイルの役割
本ファイルは、プロジェクトに初めて参加する人が知っておくべき基本概要と情報源をまとめたものです。実装の詳細や計画は `docs/` 以下の専用ページで管理しています。

## 最初に見るべき資料
- `docs/00_ProjectPlan.md`: 開発構想、技術的な実現性、致命的リスク、想定フェーズ、テスト、費用対効果。
- `docs/01_Architecture.md`: アーキテクチャの責任範囲、主要なユースケース、コンポーネント構成、物理配置、実装ビュー。
- `docs/02_ImplementationDetails.md`: コードサンプル（main/n8n-manager/port-finder/preload/renderer）、ビルド設定、実装ステップ、既知課題、テスト項目。

## 参考リンク
- n8n 公式: https://n8n.io/
- n8n GitHub: https://github.com/n8n-io/n8n
- Electron: https://www.electronjs.org/
- electron-vite: https://electron-vite.org/
- electron-builder: https://www.electron.build/
