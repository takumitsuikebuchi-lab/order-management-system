# セットアップガイド

## 概要

このドキュメントでは、受注管理システムの初期セットアップ手順を説明します。

## 前提条件

- モダンなWebブラウザ（Chrome、Edge、Safari推奨）
- ローカルHTTPサーバー（Python、Node.js、またはその他）

## セットアップ手順

### 1. ファイルの配置

ZIPファイルを解凍し、任意のディレクトリに配置します。

```bash
unzip order-system-reproduced.zip
cd order-system-reproduced
```

### 2. ローカルHTTPサーバーの起動

#### Python 3を使用する場合

```bash
python3 -m http.server 8000
```

#### Node.jsを使用する場合

```bash
npx http-server -p 8000
```

#### PHPを使用する場合

```bash
php -S localhost:8000
```

### 3. ブラウザでアクセス

サーバーが起動したら、ブラウザで以下のURLにアクセスします。

```
http://localhost:8000/受注管理システム.html
```

### 4. 初期動作確認

システムが正常に起動したら、以下の項目を確認します。

- [ ] 画面が正常に表示される
- [ ] 「＋ 新規受注」ボタンをクリックして登録フォームが開く
- [ ] 統計カードに「0件」と表示される
- [ ] 右上に「接続: ローカル」と表示される

## ローカル運用（Supabaseなし）

Supabaseを使用せず、ローカルストレージのみで運用する場合は、特別な設定は不要です。

### データの保存場所

データはブラウザの`localStorage`に保存されます。以下の点にご注意ください。

- **ブラウザごとに独立**: Chrome、Edge、Safariなど、ブラウザごとに別のデータが保存されます
- **ドメインごとに独立**: `localhost:8000`と`localhost:3000`は別のデータ領域です
- **クリアに注意**: ブラウザのキャッシュクリアでデータが消える可能性があります

### データのバックアップ

定期的にCSV出力機能を使用してデータをバックアップすることを推奨します。

1. 「📊 CSV出力」ボタンをクリック
2. ダウンロードされたCSVファイルを安全な場所に保存

## クラウド運用（Supabase使用）

複数PCでデータを共有したい場合は、Supabaseを設定します。

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスしてアカウントを作成
2. 「New project」で新しいプロジェクトを作成
3. プロジェクト名、データベースパスワード、リージョンを設定

### 2. データベーステーブルの作成

1. Supabase Studioの左メニューから「SQL Editor」を開く
2. 以下のSQLを貼り付けて「Run」を実行

```sql
-- orders テーブル作成
create table if not exists public.orders (
  id bigserial primary key,
  order_no text not null,
  date date not null,
  customer_name text not null,
  pickup_location text,
  pickup_address text,
  delivery_location text,
  delivery_address text,
  delivery_tel text,
  cargo text not null,
  quantity numeric,
  unit text,
  packaging text,
  unit_price numeric,
  amount_net numeric,
  amount_gross numeric,
  driver text,
  vehicle text,
  instructions text,
  instruction_sheet boolean default false,
  invoice_sent boolean default false,
  payment_received boolean default false,
  order_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 受注番号のユニーク制約
create unique index if not exists orders_order_no_key
  on public.orders(order_no);

-- RLSを有効化
alter table public.orders enable row level security;

-- anonロールに権限を付与（方式A）
drop policy if exists anon_select on public.orders;
drop policy if exists anon_insert on public.orders;
drop policy if exists anon_update on public.orders;
drop policy if exists anon_delete on public.orders;

create policy anon_select on public.orders
  for select to anon using (true);
create policy anon_insert on public.orders
  for insert to anon with check (true);
create policy anon_update on public.orders
  for update to anon using (true) with check (true);
create policy anon_delete on public.orders
  for delete to anon using (true);
```

### 3. API設定の取得

1. 左メニューから「Project Settings」→「API」を開く
2. 以下の情報をコピーして控える
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. CORS設定

1. 「Project Settings」→「API」→「Allowed origins」を開く
2. 以下を追加（運用環境に応じて調整）
   - `http://localhost:8000`
   - `http://127.0.0.1:8000`
   - その他、アクセス元のIPアドレスやドメイン

### 5. アプリでの設定

1. システムを開き、「☁️ クラウド設定（Supabase）」ボタンをクリック
2. 以下を入力
   - **Project URL**: 控えたProject URLを貼り付け
   - **anon key**: 控えたanon public keyを貼り付け
3. 「クラウド接続を有効化」にチェック
4. 「保存」ボタンをクリック
5. 右上のステータスが「接続: Cloud」に変わることを確認

### 6. 初期データの投入（オプション）

サンプルデータを投入する場合は、以下の手順で実施します。

1. Supabase Studioの「Table editor」→「orders」を開く
2. 右上の「Import data」をクリック
3. `CSV保存/orders_seed.csv`を選択してインポート

または、既存のローカルデータを移行する場合は、以下の手順です。

1. アプリで「📊 CSV出力」をクリックしてデータをエクスポート
2. Supabaseの「Table editor」でインポート

## トラブルシューティング

### システムが起動しない

- HTTPサーバーが正しく起動しているか確認
- ポート8000が他のプロセスで使用されていないか確認（`lsof -i :8000`）
- ブラウザのコンソールでエラーメッセージを確認

### クラウド接続ができない

- Project URLとanon keyが正しいか確認
- CORS設定でアクセス元が許可されているか確認
- ブラウザのネットワークタブで403/401エラーがないか確認
- RLSポリシーが正しく設定されているか確認

### データが保存されない

- ブラウザのlocalStorageが有効か確認
- プライベートブラウジングモードを使用していないか確認
- ブラウザのストレージ容量が十分か確認

### CSV出力ができない

- ブラウザがFile System Access APIに対応しているか確認（Chrome、Edge推奨）
- 未対応ブラウザでは通常のダウンロードで保存されます

## セキュリティに関する注意

### 方式A（anon key使用）の制限

このシステムは簡易運用モデル（方式A）を採用しているため、以下の制限があります。

- **社内ネットワーク限定**: 外部からのアクセスは推奨されません
- **認証なし**: anon keyを持つ全てのクライアントがデータにアクセス可能
- **鍵管理**: anon keyは厳重に管理し、定期的にローテーションしてください

### 推奨事項

- CORS設定で社内IPアドレスのみを許可
- anon keyをコード内にハードコードしない
- 年1回程度でanon keyをローテーション
- 重要データは定期的にバックアップ

## サポートドキュメント

詳細な運用手順については、以下のドキュメントをご参照ください。

- **README.md**: システム概要と機能説明
- **運用マニュアル.html**: 日常運用の詳細手順
- **切替手順_方式A_A社.html**: Supabase切替の詳細手順

## 次のステップ

セットアップが完了したら、以下を実施してください。

1. テストデータを登録して動作確認
2. マスタデータ（顧客、ドライバー、車両など）を実際のデータに更新
3. 会社情報をカスタマイズ（必要に応じてHTMLファイルを編集）
4. 定期的なバックアップ運用を確立

## お問い合わせ

システムに関する質問や問題が発生した場合は、運用マニュアルおよび切替手順書をご確認ください。

