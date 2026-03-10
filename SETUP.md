# セットアップ・運用ガイド

## 現在の運用環境（2026年3月時点）

| 項目 | 内容 |
|---|---|
| システムURL | `https://takumitsuikebuchi-lab.github.io/order-management-system/` |
| Supabaseプロジェクト | `kyoushinyusou_jutyuukanri` |
| Project ID | `lcckvqnwompusovmopxx` |
| Project URL | `https://lcckvqnwompusovmopxx.supabase.co` |
| Anon Key | Supabase → Project Settings → API Keys → Legacy anon キー（`eyJ...`で始まる） |

---

## 新しいPCでシステムを使い始める手順

1. ブラウザで以下のURLを開く
   ```
   https://takumitsuikebuchi-lab.github.io/order-management-system/
   ```

2. 画面上の「**クラウド設定（Supabase）**」ボタンをクリック

3. 以下を入力して保存
   - **Project URL**: `https://lcckvqnwompusovmopxx.supabase.co`
   - **Anon Key**: SupabaseダッシュボードのLegacy anon keyを貼り付け
   - **クラウド有効**: ✅ チェックを入れる

4. 「接続: Cloud」と表示されればOK。データが自動で読み込まれる

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

1. クラウド設定を入力・保存する（データが0件になるが消えていない）
2. 「**CSV出力**」で全データをエクスポート（先にやっておくと安全）
3. 「**CSV取込**」で同じCSVを読み込む
4. 各マスタ画面（顧客・積荷・荷姿・単位・ドライバー・車両）を開いて「保存」
5. SupabaseのTable Editorでデータが入ったことを確認

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
- ページをリロードすると自然に解消することがある

### データが0件になった
- クラウドを有効にするとSupabase（空）のデータが表示される
- localStorageのデータは消えていない
- 「CSV取込」でCSVを読み込めばデータが復元される
- CSVがない場合：クラウドを一時無効化 → データが再表示 → CSV出力 → クラウド再有効化 → CSV取込

### URLを変えたらデータが見えなくなった
- localStorageはURLのドメインごとに独立している
- 旧URLでCSV出力 → 新URLでCSV取込 でデータを移行できる

### Supabaseの無料プランについて
- 7日間アクセスがないと自動停止する
- 毎日使っていれば停止しない
- 停止した場合は上記「Supabaseが停止した場合の対処」を参照

---

## セキュリティについて

- Anon KeyはブラウザのlocalStorageに保存される（コード内には含まれない）
- このシステムは社内ネットワーク内での使用を想定している
- Anon Keyを他人に共有しない
- 年1回程度でAnon Keyのローテーションを推奨
