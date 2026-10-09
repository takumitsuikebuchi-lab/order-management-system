-- 2026-10-09 本番稼働1年レビューで提案した DB 側の保護策（データは一切変更・削除しない）
-- 状態: 未適用（ユーザーの確認後に Supabase の SQL Editor で実行する）
-- 何度実行しても同じ結果になるように書いてある。取り消しは末尾の「元に戻す」を実行する。

-- ---------------------------------------------------------------
-- 1) 一括削除の防止
--    アプリは受注を1件ずつ、マスタを最大50件ずつしか消さない。
--    それより多くの行を1回で消そうとした場合（誤操作・古い画面からの全件削除・第三者による一括削除）は、
--    削除そのものを取り消してエラーにする。
-- ---------------------------------------------------------------
create or replace function public.guard_bulk_delete()
returns trigger
language plpgsql
as $$
declare
  limit_rows integer := coalesce(nullif(tg_argv[0], '')::integer, 1);
  deleted_count integer;
begin
  select count(*) into deleted_count from deleted_rows;
  if deleted_count > limit_rows then
    raise exception '一括削除を拒否しました（% から % 行。1回で消せるのは % 行まで）', tg_table_name, deleted_count, limit_rows
      using errcode = 'P0001',
            hint = '本当に必要な場合は、管理者が一時的にトリガーを無効化してから実行してください';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_guard_bulk_delete on public.orders;
create trigger trg_orders_guard_bulk_delete
  after delete on public.orders
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete('1');

drop trigger if exists trg_customers_guard_bulk_delete on public.customers;
create trigger trg_customers_guard_bulk_delete
  after delete on public.customers
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete('50');

drop trigger if exists trg_simple_masters_guard_bulk_delete on public.simple_masters;
create trigger trg_simple_masters_guard_bulk_delete
  after delete on public.simple_masters
  referencing old table as deleted_rows
  for each statement execute function public.guard_bulk_delete('50');

-- ---------------------------------------------------------------
-- 2) 検索用インデックス（件数が増えても一覧・差分同期が遅くならないように）
-- ---------------------------------------------------------------
create index if not exists idx_orders_date on public.orders (date);
create index if not exists idx_orders_updated_at on public.orders (updated_at);
create index if not exists idx_customers_customer_name on public.customers (customer_name);
create index if not exists idx_simple_masters_type_order on public.simple_masters (master_type, sort_order);

-- ---------------------------------------------------------------
-- 確認用（実行後にこれで 3 行出れば適用済み）
-- select tgname from pg_trigger where tgname like 'trg_%_guard_bulk_delete';
--
-- 元に戻す（必要なときだけ）
-- drop trigger if exists trg_orders_guard_bulk_delete on public.orders;
-- drop trigger if exists trg_customers_guard_bulk_delete on public.customers;
-- drop trigger if exists trg_simple_masters_guard_bulk_delete on public.simple_masters;
-- drop function if exists public.guard_bulk_delete();
-- ---------------------------------------------------------------
