# n8tive Release Process

## 概要
n8tive のリリースプロセスは、electron-builder と GitHub Releases を使用した自動化されたワークフローです。ドラフトリリースを作成し、手動レビュー後に公開する安全なプロセスを採用しています。

## 前提条件

### 1. GitHub Personal Access Token の作成

1. GitHub の設定ページに移動: https://github.com/settings/tokens?type=beta
2. "Generate new token" をクリック
3. トークン名: `n8tive-releases`
4. 有効期限: 90 日（カレンダーリマインダーを設定推奨）
5. リポジトリアクセス: "Only select repositories" → `mosaan/n8tive` を選択
6. 権限:
   - Repository permissions → Contents → Access: **Read and write**
7. "Generate token" をクリックしてトークンをコピー

### 2. 環境変数 GH_TOKEN の設定

#### 方法 1: .env ファイル（推奨）

最もセキュアかつ便利な方法です。

```powershell
# 1. .env.example をコピーして .env を作成
Copy-Item .env.example .env

# 2. .env ファイルを編集してトークンを設定
# GH_TOKEN=ghp_your_actual_token_here

# 3. リリース時にスクリプトでトークンを読み込む
. .\scripts\set-gh-token.ps1
```

**メリット**:
- `.env` ファイルは `.gitignore` で除外済み（Git に誤コミットされない）
- プロジェクト単位で管理できる
- スクリプトで自動読み込み

#### 方法 2: 現在のセッションのみ（PowerShell）

一時的な使用に適しています。

```powershell
# トークンを設定
$env:GH_TOKEN = "ghp_your_token_here"

# 確認
echo $env:GH_TOKEN
```

#### 方法 3: 永続的な設定（ユーザー環境変数）

すべてのプロジェクトで同じトークンを使う場合に便利です。

1. Win + R → `sysdm.cpl` を実行
2. "詳細設定" → "環境変数"
3. "ユーザー環境変数" → "新規"
4. 変数名: `GH_TOKEN`
5. 変数値: `ghp_your_token_here`
6. ターミナル/IDE を再起動

**重要**: トークンは絶対に Git にコミットしないでください

## リリース手順

### Option 1: ドラフトリリース作成（推奨）

#### 1. バージョン更新（必要な場合）

**n8n のバージョンを更新する場合**:
```bash
# n8n-version.json を編集
echo '{"n8n": "^2.1.0"}' > n8n-version.json
```

**n8tive ラッパーのバージョンを更新する場合**:
```javascript
// scripts/update-version.js を編集
const N8TIVE_VERSION = '1.1.0';  // この値を変更
```

#### 2. ビルドして GitHub に公開

```powershell
# GH_TOKEN を読み込む（.env ファイルを使用している場合）
. .\scripts\set-gh-token.ps1

# ビルドして公開
pnpm package:publish
```

**別の方法**（.env を使わない場合）:
```powershell
# 手動でトークンを設定
$env:GH_TOKEN = "your_token_here"

# ビルドして公開
pnpm package:publish
```

**実行内容**:
- `update:version` - バージョン文字列を自動生成
- `prepare:n8n` - n8n の依存関係を準備
- `build` - Electron アプリをビルド
- `electron-builder --publish always` - GitHub にアップロード

#### 3. ドラフトリリースを確認

1. GitHub のリリースページに移動: https://github.com/mosaan/n8tive/releases
2. ドラフトリリースが作成されていることを確認
3. アップロードされたファイルを確認:
   - `n8tive Setup X.X.X.exe` - インストーラー（約 320MB）
   - `n8tive Setup X.X.X.exe.blockmap` - 差分更新用メタデータ
   - `latest.yml` - 自動更新設定
4. ファイルサイズと SHA512 ハッシュを確認

#### 4. リリースノートを追加

1. ドラフトリリースの "Edit" をクリック
2. リリースノートを記入:
   ```markdown
   ## 変更内容
   - 新機能: xxx
   - 改善: xxx
   - バグ修正: xxx

   ## インストール方法
   1. `n8tive Setup X.X.X.exe` をダウンロード
   2. インストーラーを実行
   3. インストールディレクトリを選択
   4. インストール完了後、n8tive を起動

   ## バンドルされた n8n バージョン
   - n8n: X.X.X
   ```
3. "Save draft" をクリック

#### 5. リリースを公開

1. 内容を確認後、"Publish release" をクリック
2. Git タグが自動的に作成される（例: `v1.0.0+n8n.2.0.2`）
3. ユーザーがダウンロード可能になる

### Option 2: タグベースのリリース

#### 1. ローカルでタグを作成

```bash
# バージョンタグを作成
git tag -a v1.0.0+n8n.2.0.2 -m "Release 1.0.0 with n8n 2.0.2"

# GitHub にプッシュ
git push origin v1.0.0+n8n.2.0.2
```

#### 2. ビルドして公開

```powershell
$env:GH_TOKEN = "your_token"
pnpm package:publish
```

## バージョニング方式

### 形式
```
{n8tive-version}+n8n.{n8n-version}
```

### 例
- `1.0.0+n8n.2.0.2` - 初回リリース、n8n 2.0.2 をバンドル
- `1.1.0+n8n.2.1.0` - ラッパー機能追加、n8n 2.1.0 にアップデート
- `1.0.1+n8n.2.0.2` - ラッパーのバグフィックス、n8n は同じバージョン

### バージョン管理
- **n8tive ラッパー**: `scripts/update-version.js` の `N8TIVE_VERSION` 定数
- **n8n**: `n8n-version.json` の `n8n` フィールド
- **自動生成**: `pnpm run update:version` で `package.json` に書き込み

詳細は `docs/00_ProjectPlan.md` の「1.3 バージョニングポリシー」を参照してください。

## 公開されるファイル

### 自動アップロードされるファイル

1. **n8tive Setup {version}.exe** (約 320MB)
   - Windows インストーラー（NSIS形式）
   - ユーザー選択可能なインストールディレクトリ
   - アンインストーラー付属

2. **n8tive Setup {version}.exe.blockmap**
   - 差分更新用のメタデータ
   - 小さいファイル（数KB）
   - 将来の自動更新機能で使用

3. **latest.yml**
   - 自動更新の設定ファイル
   - 最新バージョン情報とダウンロードURL
   - SHA512 ハッシュとファイルサイズ

### ファイル命名規則

- **タグ名**: `v1.0.0+n8n.2.0.2` (完全なバージョン)
- **インストーラー名**: `n8tive Setup 1.0.0.exe` (簡略版)
- **latest.yml の version**: `1.0.0` (ベースバージョンのみ)

## トラブルシューティング

### "No GitHub token found"

**原因**: 環境変数 `GH_TOKEN` が設定されていない

**解決策**:
```powershell
# トークンが設定されているか確認
echo $env:GH_TOKEN

# 設定されていない場合は設定
$env:GH_TOKEN = "ghp_your_token_here"
```

### "HTTP 403 Forbidden"

**原因**:
- トークンの有効期限切れ
- 権限不足（Contents の Read and write が必要）
- リポジトリアクセス権の喪失

**解決策**:
1. 新しいトークンを生成
2. 権限を再確認
3. リポジトリアクセスを確認

### "Release already exists"

**原因**: 同じバージョンのリリースが既に存在する

**解決策**:
- GitHub でドラフトリリースを削除
- バージョン番号をインクリメント
- または `--publish never` を使用してビルドのみ実行

### アップロード失敗

**原因**: ネットワーク問題、ファイルサイズ制限

**解決策**:
- ドラフトリリースは再試行可能
- GitHub の Web インターフェースから手動アップロード
- ネットワーク接続を確認

## ベストプラクティス

1. **ローカルテスト**
   - 公開前に必ずローカルでビルドをテスト
   - インストーラーを実行して動作確認

2. **ドラフトレビュー**
   - 必ずドラフトリリースで確認
   - ファイルサイズとハッシュを検証
   - リリースノートを丁寧に記述

3. **バージョン管理**
   - セマンティックバージョニングに従う
   - n8n バージョンと n8tive バージョンを明確に区別

4. **タグ管理**
   - 公開後はタグを作成（Option 1 の場合）
   - タグには詳細なメッセージを付ける

5. **ストレージ管理**
   - 古いリリースはアーカイブ
   - ダウンロード統計を定期的に確認

6. **セキュリティ**
   - トークンを定期的にローテーション
   - トークンの有効期限を設定
   - パスワードマネージャーでトークンを管理

## 自動更新の設定

### latest.yml の役割

公開された `latest.yml` ファイルは、将来の自動更新機能で使用されます:

```yaml
version: 1.0.0
files:
  - url: n8tive-Setup-1.0.0.exe
    sha512: <hash>
    size: 319771767
path: n8tive-Setup-1.0.0.exe
sha512: <hash>
releaseDate: '2025-12-16T10:49:38.261Z'
```

**用途**:
- electron-updater による差分更新
- バージョンチェック
- ダウンロードURL の提供
- 整合性検証（SHA512）

### 将来の自動更新実装

アプリ内に自動更新機能を追加する場合:
1. `electron-updater` パッケージをインストール
2. メインプロセスで自動更新チェックを実装
3. ユーザーに更新通知を表示
4. バックグラウンドで差分ダウンロード

## GitHub Actions による自動化（将来）

手動リリースに慣れた後、GitHub Actions で自動化可能:

### メリット
- タグプッシュで自動ビルド
- 一貫したビルド環境
- ローカルトークン不要
- リリース履歴の監査

### 実装
`.github/workflows/release.yml` を作成（詳細は計画書を参照）

## セキュリティ考慮事項

### トークン管理

1. **コミット厳禁**
   - `.env` ファイルは `.gitignore` に追加済み
   - `gh_token.txt` も除外設定済み
   - 平文ファイルでの保存は避ける

2. **最小権限**
   - Fine-grained token を使用
   - 単一リポジトリにスコープ
   - Contents の Read and write のみ
   - 有効期限を設定

3. **トークン保管**
   - Windows 資格情報マネージャー
   - パスワードマネージャー（1Password、Bitwarden など）
   - 環境変数のみ（ファイル保存は避ける）

### リリース整合性

1. **アップロード検証**
   - `latest.yml` の SHA512 ハッシュを確認
   - ダウンロードリンクをテスト
   - ファイルサイズがローカルビルドと一致

2. **コード署名（将来の強化）**
   - コード署名証明書を取得
   - Windows インストーラーに署名
   - SmartScreen 警告を回避
   - ユーザーの信頼を向上

3. **ドラフトレビューチェックリスト**
   - [ ] すべてのファイルが正常にアップロードされた
   - [ ] ハッシュがローカルビルドと一致
   - [ ] バージョン番号が正しい
   - [ ] リリースノートが完全
   - [ ] アーティファクトに機密情報が含まれていない
   - [ ] インストーラーをローカルでテスト済み

## リリース後の作業

1. **動作確認**
   - クリーンな環境でインストールテスト
   - n8n の起動確認
   - ワークフロー実行テスト

2. **ドキュメント更新**
   - README にリリース情報を追加
   - CHANGELOG を更新
   - プロジェクト計画を更新

3. **コミュニティ通知**
   - GitHub Discussions で告知
   - SNS で共有（該当する場合）
   - ユーザーにメール通知（該当する場合）

4. **監視**
   - ダウンロード数を確認
   - GitHub Issues で問題報告を監視
   - ユーザーフィードバックを収集

## ロールバック戦略

リリース後に問題が発覚した場合:

1. **即座の対応**
   - リリースをプレリリースとしてマーク
   - または完全に削除
   - 修正版を直ちに公開

2. **バージョンロールバック**
   - より高いバージョン番号で新しいリリースを作成
   - リリースノートに既知の問題を記載
   - 前の安定版を指し示す

3. **コミュニケーション**
   - リリースノートに既知の問題を更新
   - GitHub Issue をピン留め
   - 既知のユーザーにメール（該当する場合）

## 参考リンク

- [electron-builder Publishing](https://www.electron.build/publish.html)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [SemVer Specification](https://semver.org/)
- [electron-updater](https://www.electron.build/auto-update.html)

## まとめ

n8tive のリリースプロセスは、安全性と利便性のバランスを重視しています:

- **ドラフトリリース**: 公開前に確認可能
- **自動バージョン管理**: 手動編集不要
- **セキュアな認証**: Fine-grained token
- **将来の拡張性**: 自動更新・GitHub Actions対応

質問やフィードバックは、GitHub Issues でお気軽にお寄せください。
