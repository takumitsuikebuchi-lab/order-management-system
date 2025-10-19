# Netlify デプロイ手順

## 概要

完全版の運行指示書機能を実装したシステムをNetlifyにデプロイする手順です。

## 前提条件

- GitHubリポジトリ: `takumitsuikebuchi-lab/order-management-system`
- 既存のNetlifyサイト: `https://relaxed-horse-f01b82.netlify.app/`

## デプロイ手順

### 1. Netlifyにログイン

1. [Netlify](https://app.netlify.com/)にアクセス
2. GitHubアカウントでログイン

### 2. 既存サイトの設定を更新

1. ダッシュボードから既存のサイト（relaxed-horse-f01b82）を選択
2. 「Site settings」→「Build & deploy」→「Link repository」をクリック
3. GitHubリポジトリ `takumitsuikebuchi-lab/order-management-system` を選択
4. ブランチを `main` に設定
5. 「Save」をクリック

### 3. 手動デプロイ

1. 「Deploys」タブに移動
2. 「Trigger deploy」→「Deploy site」をクリック
3. デプロイの完了を待つ（1〜2分）

### 4. 動作確認

1. デプロイ完了後、サイトURL（https://relaxed-horse-f01b82.netlify.app/）にアクセス
2. セットアップウィザードでローカル運用を選択
3. 受注データを3件追加
4. 3件を選択して「運行指示書（選択分）」をクリック
5. 配車時間を入力して「運行指示書を出力」をクリック
6. 以下の要素が全て表示されることを確認:
   - ✅ 配車時間表示（黄色背景、16pt）
   - ✅ 標準指示事項（法定速度、休憩時間等）
   - ✅ 法令遵守に基づく運行計画（記入欄）
   - ✅ 運行管理者押印スペース
   - ✅ フッター注記（輸送安全規則）

## トラブルシューティング

### デプロイが失敗する場合

1. Netlifyのデプロイログを確認
2. GitHubリポジトリの内容を確認
3. 必要に応じて再度プッシュ

### サイトが更新されない場合

1. ブラウザのキャッシュをクリア（Ctrl+Shift+R / Cmd+Shift+R）
2. Netlifyで「Clear cache and deploy site」を実行

## 完了

デプロイが完了し、全ての要素が正しく表示されれば、運行指示書の改修は完了です。

