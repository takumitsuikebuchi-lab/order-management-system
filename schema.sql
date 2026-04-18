-- 受注管理システム DB スキーマ正本
-- 対象時点: 2026-04-18

create extension if not exists pgcrypto;

create table if not exists orders (
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
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

-- 更新時に updated_at を自動更新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  pickup_address text,
  delivery_address text,
  phone_number text,
  created_at timestamptz default now()
);

create table if not exists simple_masters (
  id uuid primary key default gen_random_uuid(),
  master_type text not null,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table orders enable row level security;
alter table customers enable row level security;
alter table simple_masters enable row level security;

drop policy if exists "allow_all_orders" on orders;
drop policy if exists "allow_all_customers" on customers;
drop policy if exists "allow_all_simple_masters" on simple_masters;

create policy "allow_all_orders" on orders
for all
using (true)
with check (true);

create policy "allow_all_customers" on customers
for all
using (true)
with check (true);

create policy "allow_all_simple_masters" on simple_masters
for all
using (true)
with check (true);
