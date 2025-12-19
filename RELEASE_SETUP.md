# リリース環境のセットアップ

GitHub Releases に公開するための環境設定手順です。

## 1. GitHub Personal Access Token の作成

1. https://github.com/settings/tokens?type=beta にアクセス
2. "Generate new token" をクリック
3. 以下の設定を行う:
   - トークン名: `n8tive-releases`
   - 有効期限: 90 日
   - リポジトリアクセス: `mosaan/n8tive` のみ
   - 権限: Contents の Read and write
4. トークンをコピー（後で使用）

## 2. .env ファイルの作成

```powershell
# .env.example をコピー
Copy-Item .env.example .env

# .env ファイルを編集
notepad .env
```

`.env` ファイル内で、トークンを設定:
```
GH_TOKEN=ghp_ここに実際のトークンを貼り付け
```

保存して閉じます。

## 3. 動作確認

```powershell
# トークンが正しく読み込まれるか確認
. .\scripts\set-gh-token.ps1
```

成功すると:
```
✓ Loaded GH_TOKEN

GitHub token loaded successfully!
You can now run: pnpm package:publish
```

## リリース方法

詳細は `docs/07_ReleaseProcess.md` を参照してください。

基本的な流れ:
```powershell
# 1. トークンを読み込む
. .\scripts\set-gh-token.ps1

# 2. ビルドして公開（ドラフト作成）
pnpm package:publish

# 3. GitHub でドラフトを確認して公開
# https://github.com/mosaan/n8tive/releases
```

## セキュリティ注意事項

- `.env` ファイルは Git に**絶対にコミットしない**（`.gitignore` で除外済み）
- トークンは他人と共有しない
- 有効期限が切れたら新しいトークンを作成
