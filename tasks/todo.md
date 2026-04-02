# タスク管理

作業開始時に計画を書き出し、完了したらチェックを入れる。
過去のタスクは削除せず、日付ごとにセクションを分けて残す。

---

## テンプレート

新しい作業を始めるときは以下をコピーして使う:

```
## YYYY-MM-DD: [作業タイトル]

### 背景・目的
（なぜこの作業が必要か）

### 計画
- [ ] ステップ1
- [ ] ステップ2
- [ ] ステップ3
- [ ] 動作確認

### 結果
（完了後に記録）
```

---

## 2026-04-01: ドキュメント整備・CLAUDE.md作成

### 背景・目的
プロジェクト全体のファイルを精査し、Claude Codeが正しく動作するための
CLAUDE.mdと、タスク管理用のtodo.mdを整備する。

### 計画
- [x] プロジェクト全体の構造を確認
- [x] CLAUDE.md（プロジェクト直下）を作成
- [x] tasks/todo.md を作成
- [x] メモリファイルを作成（将来の会話への引き継ぎ用）

### 結果
- CLAUDE.md: 作業前の読むべきファイル順・禁止事項・ルール・落とし穴を記載
- tasks/todo.md: テンプレートと今回の作業ログを記録
- メモリ: プロジェクト概要・ユーザープロファイルを保存

---

## 2026-04-01: データ保護ルール追記・月次自動バックアップ設定

### 背景・目的
受注履歴・業務記録の消失は会社にとって重大な損害になるため、
Claudeへの指示にデータ保護ルールを明記し、月末の自動CSVバックアップを設定する。

### 計画
- [x] CLAUDE.md にデータ保護の最重要ルールを追記
- [x] `.github/workflows/monthly-backup.yml` を作成（月末自動バックアップ）
- [x] `backups/` フォルダを作成（バックアップ保存先）

### 結果
- CLAUDE.md: データ削除禁止・スキーマ変更ルール・バックアップ確認義務を5項目で明記
- monthly-backup.yml: 毎月末日の深夜0時（JST）に受注明細・顧客マスタをCSV保存
- backups/: 例）`backups/2026-03_受注明細.csv` の形式で蓄積される
- 手動実行（緊急バックアップ）にも対応（GitHubのActionsタブから実行可能）
- 完全無料（公開リポジトリのためGitHub Actions使い放題）

---

## 2026-04-02: 顧客マスタ新規登録がリロード後に消える不具合の修正

### 背景・目的
「＋ 新規追加」で顧客を登録してもリロードすると消える不具合が報告された。
原因調査・修正をClaudeとCodexで分担して対応。

### 計画
- [x] ブラウザで動作確認・原因調査
- [x] cloudSaveCustomers の DELETE URL長すぎ問題を修正（`?id=not.is.null` 方式へ）
- [x] cloudFetchCustomers に `&limit=10000` を追加
- [x] saveNewCustomer を async/await 化して保存完了を待つよう修正
- [x] Supabase の重複30,847件をクリーンアップ（削除→正しい1,000件を再投入）
- [x] Codex が根本原因を特定・修正（`cloudInsertCustomer` 新設、ページング取得）
- [x] ドキュメント更新（AGENTS.md・CHANGELOG.md はCodex、lessons.md・todo.md はClaude）

### 結果
- 根本原因: 1件追加のたびに全件DELETE+再INSERTしていた設計 + Supabase 1,000件上限 + 非同期の競合
- Codex の修正: `cloudInsertCustomer()`（1件だけInsert）を新設し saveNewCustomer から呼ぶ方式へ変更
- Codex の修正: `cloudFetchCustomers()` を Range ヘッダによるページング取得に変更
- Supabase の customers テーブルを重複838件削除し163件に正常化
- 詳細な教訓は `tasks/lessons.md` の2026-04-02エントリに記録済み

