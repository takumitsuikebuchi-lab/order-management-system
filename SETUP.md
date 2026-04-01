# セットアップ・運用ガイド

## 現在の運用環境（2026年3月時点）

| 項目 | 内容 |
|---|---|
| システムURL | `https://takumitsuikebuchi-lab.github.io/order-management-system/` |
| Supabaseプロジェクト | 本番共有プロジェクト |
| Project ID | `xrmczawpwpctbpuebddi` |
| Project URL | `https://xrmczawpwpctbpuebddi.supabase.co` |
| Anon Key | `cloud-config.json` に保存されている Legacy anon キー |
| デフォルトブランチ | `main` |
| 補助ブランチ | `master`（互換維持のため自動同期） |

### まず読むべき文書

- `CLAUDE.md`: Claude Code向けの指示書（作業前の必読ファイル順・データ保護ルール）
- `requirements.md`: システムが満たすべき要件と壊してはいけない仕様
- `SETUP.md`: 運用・復旧・セットアップ手順
- `RUNBOOK.md`: 障害時の初動確認
- `TEST_CHECKLIST.md`: 修正後の最低限確認項目
- `schema.sql`: 新規環境構築時の DB スキーマ正本
- `AGENTS.md`: AI ツール向けの保守メモ

### 直近の整理（2026-03-17）

- GitHub のデフォルトブランチを `master` から `main` に変更
- `main` に push した内容を `master` に自動同期するワークフローを追加
- `index.html` に共有クラウド設定の埋め込みフォールバックを追加
- これにより、新しい端末やブラウザでも起動失敗しにくい構成になっています

### 直近のUI整理（2026-03-18）

- 受注一覧の検索UIは `顧客検索` 1欄に統一
- この欄は手入力による絞り込みと候補一覧からの選択の両方に対応
- 顧客絞り込みの解除は右端の `クリア` ボタンで行う
- 日付絞り込みの解除は `日付解除` ボタンで行う
- バックグラウンドのクラウド再同期が入っても、表示中の絞り込み条件は維持される

### バックアップ体制（2026-04-01）

- **週次自動バックアップ**が `.github/workflows/weekly-backup.yml` で設定済み
- 毎週水曜日の深夜0時（JST）にSupabaseから受注明細・顧客マスタを取得し、`backups/` フォルダにCSV保存
- ファイル名例: `backups/2026-04-02_受注明細.csv` / `backups/2026-04-02_顧客マスタ.csv`
- 初回バックアップは設定後の最初の水曜深夜0時に自動作成されます（それまで `backups/` フォルダは空です）
- 緊急バックアップはGitHub → Actions → 「Weekly Backup」→「Run workflow」から即時実行可能
- 受注データに影響する改修を行う前に、必ず最新のバックアップが存在することを確認する

### 自動確認の現在地（2026-03-19）

- GitHub Actions の `Guard And Sync` で Playwright UI smoke test を自動実行
- 現在は、受注CRUD、検索・絞り込み、月切替、統計カード、印刷、CSV入出力、クラウド再同期、キュー回復、空マスタ同期まで自動確認する
- 修正後に手元で確認する場合は `npm run test:ui`

---

## 新しいPCでシステムを使い始める手順

1. ブラウザで以下のURLを開く
   ```
   https://takumitsuikebuchi-lab.github.io/order-management-system/
   ```

2. 数秒待って右上が `接続: Cloud（同期完了）` になることを確認
3. 受注一覧やマスター情報が表示されれば利用開始できる

### 補足

- 現在は `cloud-config.json` の共通設定を全ブラウザが自動読込します
- 念のため `index.html` にも同じ接続先のフォールバックを埋め込んでいます
- 通常運用では、画面の「クラウド設定（Supabase）」を編集する必要はありません
- 新しいPCや新しいブラウザでも、同じURLを開けば同じクラウドデータが見える前提です

---

## 受注一覧の絞り込みについて

- `顧客検索` は、直接文字を打っても、候補一覧から顧客名を選んでも使えます
- 顧客の絞り込みを解除したいときは、右端の `クリア` を押します
- 日付の絞り込みを解除したいときは、`日付解除` を押します
- クラウド同期が裏で走っても、表示中の絞り込み条件は維持されます

---

## クラウド設定を変更する場所

通常は [`cloud-config.json`](cloud-config.json) を編集します。

- **変更対象**: Project URL / anon key / enabled
- **反映方法**: ファイル更新 → commit → push → GitHub Pages反映待ち → ブラウザをハードリロード
- **通常運用の画面上設定**: 共通設定が有効な間はロックされます
- **注意**: `cloud-config.json` を変更したら、`index.html` 内の埋め込みフォールバックも同じ値にそろえる

### 画面から一時的に変更したい場合

緊急保守時だけ、以下で手動変更できます。

```text
https://takumitsuikebuchi-lab.github.io/order-management-system/index.html?manualCloudConfig=1
```

- これは診断・一時復旧用です
- 最終的な正しい設定は必ず `cloud-config.json` に戻してください

---

## Supabaseが停止した場合の対処

Supabaseの無料プランは**7日間アクセスがないと自動停止**します。
停止後90日を過ぎるとダッシュボードから復旧できなくなります。

### 停止直後（90日以内）の場合
1. [supabase.com](https://supabase.com) にログイン
2. 停止中のプロジェクトを開いて「Restore project」をクリック
3. 復旧後、システムのクラウド設定を再確認

### 90日以上経過して復旧できない場合
1. **バックアップを取得**: Supabaseダッシュボードの「Download backups」
2. **新しいプロジェクトを作成**: 下記「Supabaseセットアップ手順」を参照
3. **データ移行**: 既存データがlocalStorageに残っている場合は「CSV出力 → CSV取込」で移行

---

## 既存データをSupabaseに移行する方法

ローカル（localStorage）のデータをSupabaseに移す手順。

1. 本番URLを開き、右上が `接続: Cloud（同期完了）` になることを確認する
2. 「**CSV出力**」で全データをエクスポートする
3. 「**CSV取込**」で同じCSVを読み込む
4. 各マスタ画面（顧客・積荷・荷姿・単位・ドライバー・車両）を開いて「保存」する
5. SupabaseのTable Editorでデータが入ったことを確認する

---

## Supabaseセットアップ手順（新規作成時）

### 1. プロジェクト作成
1. [supabase.com](https://supabase.com) にログイン
2. 「New project」で作成（リージョン: Tokyo推奨）

### 2. テーブル作成（SQL Editorで実行）

```sql
-- 受注テーブル
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  date date,
  customer_name text,
  pickup_location text,
  pickup_address text,
  delivery_location text,
  delivery_address text,
  delivery_tel text,
  cargo text,
  quantity numeric,
  unit text,
  packaging text,
  unit_price numeric,
  amount_net numeric,
  amount_gross numeric,
  instructions text,
  driver text,
  vehicle text,
  instruction_sheet boolean default false,
  invoice_sent boolean default false,
  payment_received boolean default false,
  order_completed boolean default false,
  created_at timestamptz default now()
);

-- 顧客マスタテーブル
create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  pickup_address text,
  delivery_address text,
  phone_number text,
  created_at timestamptz default now()
);

-- シンプルマスタテーブル（ドライバー・車両・積荷・荷姿・単位）
create table simple_masters (
  id uuid primary key default gen_random_uuid(),
  master_type text not null,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RLS有効化・匿名アクセス許可
alter table orders enable row level security;
alter table customers enable row level security;
alter table simple_masters enable row level security;

create policy "allow_all_orders" on orders for all using (true) with check (true);
create policy "allow_all_customers" on customers for all using (true) with check (true);
create policy "allow_all_simple_masters" on simple_masters for all using (true) with check (true);
```

### 3. 接続情報の取得
- **Project URL**: Settings → General → Project ID から `https://{ID}.supabase.co`
- **Anon Key**: Settings → API Keys → **Legacy anon, service_role API keys** タブ → `anon` キー（`eyJ...`で始まるもの）

---

## トラブルシューティング

### クラウド同期エラーが出る
- Anon Keyが正しいか確認（`eyJ...`で始まるLegacy形式を使う）
- `sb_publishable_...`で始まるキーは**非対応**
- Project URLの末尾に `/` が入っていないか確認
- `cloud-config.json` が意図したSupabaseプロジェクトを指しているか確認
- ハードリロードすると解消することがある
- `接続: Cloud（エラー ・キュー:n）` のように表示される場合は、ローカル保存は残っていて再送待ちの可能性が高い

### PCやブラウザごとにデータが違う
- まず右上表示が `接続: Cloud（同期完了）` か確認
- `接続: Cloud（エラー）` や `接続: ローカル` の場合は、通信または設定を疑う
- `cloud-config.json` が正しいか確認
- そのブラウザで過去に `?manualCloudConfig=1` を使っていないか確認
- ハードリロード後も差が出る場合は、AIツールに `SETUP.md` と `AGENTS.md` を読ませて対応する

### データが0件になった
- クラウドを有効にするとSupabase（空）のデータが表示される
- localStorageのデータは消えていない
- 「CSV取込」でCSVを読み込めばデータが復元される
- CSVがない場合：クラウドを一時無効化 → データが再表示 → CSV出力 → クラウド再有効化 → CSV取込

### URLを変えたらデータが見えなくなった
- localStorageはURLのドメインごとに独立している
- 旧URLでCSV出力 → 新URLでCSV取込 でデータを移行できる

### 同じ受注を複数端末で開いて保存した
- 現在は軽量な競合検知が入っている
- 別端末で先に更新されていた場合、保存時に警告して止まる
- 警告が出たら、いったん閉じて最新の受注を開き直す

### Supabaseの無料プランについて
- 7日間アクセスがないと自動停止する
- 毎日使っていれば停止しない
- 停止した場合は上記「Supabaseが停止した場合の対処」を参照

---

## セキュリティについて

- Anon Keyは共通設定 `cloud-config.json` とブラウザのlocalStorageに保持される
- このシステムは社内ネットワーク内での使用を想定している
- Anon Keyを他人に共有しない
- 年1回程度でAnon Keyのローテーションを推奨

---

## AIツールに相談するときの伝え方

**Claude Codeを使う場合**はリポジトリに `CLAUDE.md` があるので、自動的に読み込まれます。追加の説明は不要です。

**その他のAIツール（Codex / Cursor など）に依頼する場合**は、次の4点を伝えると早いです。

1. 本番URL: `https://takumitsuikebuchi-lab.github.io/order-management-system/`
2. 共通クラウド設定は `cloud-config.json` が正本
3. 通常運用ではクラウド設定UIはロックされている
4. まず `CLAUDE.md` `requirements.md` `AGENTS.md` `SETUP.md` を読んでから対応してほしい

これで、運用方式の誤解による再設定ミスをかなり防げます。
