-- Water Station: schema, security, and business logic
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Everything lives in the `water_station` schema. After running, expose it:
-- Dashboard > Settings > API > Exposed schemas > add `water_station`.

create schema if not exists water_station;
grant usage on schema water_station to anon, authenticated, service_role;
alter default privileges in schema water_station grant all on tables to authenticated, service_role;
alter default privileges in schema water_station grant all on sequences to authenticated, service_role;
alter default privileges in schema water_station grant execute on functions to authenticated, service_role;

-- ───────────────────────── Tables ─────────────────────────

create table if not exists water_station.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'staff')) default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists water_station.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  address text,
  -- containers the customer currently holds that still belong to the station
  container_balance integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists water_station.inventory_items (
  id uuid default gen_random_uuid() primary key,
  item_name text not null unique,
  stock_quantity integer not null default 0,
  unit_cost numeric(10,2) not null default 0,
  reorder_level integer not null default 100
);

-- Price list + per-unit cost breakdown. Admin only (staff read the safe view below).
create table if not exists water_station.products (
  code text primary key,                         -- 'slim_5gal'
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  cogs_water numeric(10,2) not null default 0,
  cogs_power numeric(10,2) not null default 0,
  cogs_caps numeric(10,2) not null default 0,
  cogs_delivery numeric(10,2) not null default 0,
  cogs_total numeric(10,2) generated always as (cogs_water + cogs_power + cogs_caps + cogs_delivery) stored,
  inventory_item_id uuid references water_station.inventory_items(id) on delete set null, -- consumed 1 per unit sold
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists water_station.orders (
  id uuid default gen_random_uuid() primary key,
  order_number serial,
  customer_id uuid references water_station.customers(id),
  total_amount numeric(10,2) not null default 0,
  status text not null check (status in ('pending','out_for_delivery','delivered','cancelled')) default 'pending',
  payment_status text not null check (payment_status in ('unpaid','paid')) default 'unpaid',
  qr_tag_id text,                                -- last tag used (history); live link lives in qr_tags
  created_by uuid references water_station.profiles(id),
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  delivered_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_idx on water_station.orders(status);
create index if not exists orders_delivered_at_idx on water_station.orders(delivered_at);

-- COGS lives apart from orders so staff never see it.
create table if not exists water_station.order_costs (
  order_id uuid primary key references water_station.orders(id) on delete cascade,
  cogs_amount numeric(10,2) not null default 0
);

create table if not exists water_station.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references water_station.orders(id) on delete cascade,
  container_type text not null references water_station.products(code),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null
);
create index if not exists order_items_order_idx on water_station.order_items(order_id);

-- Reusable laminated tags. One live order per tag, enforced by the unique column.
create table if not exists water_station.qr_tags (
  tag_code text primary key,                     -- 'TAG-005'
  enabled boolean not null default true,
  active_order_id uuid unique references water_station.orders(id) on delete set null
);

create table if not exists water_station.expense_categories (
  name text primary key
);

create table if not exists water_station.expenses (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  amount numeric(10,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references water_station.profiles(id)
);
create index if not exists expenses_date_idx on water_station.expenses(expense_date);

-- ───────────────────────── Helpers ─────────────────────────

create or replace function water_station.is_admin() returns boolean
language sql security definer stable set search_path = water_station as $$
  select exists (select 1 from water_station.profiles where id = auth.uid() and role = 'admin');
$$;

-- Every new auth user becomes staff. Promote the first admin by hand (see bottom).
create or replace function water_station.handle_new_user() returns trigger
language plpgsql security definer set search_path = water_station as $$
begin
  insert into water_station.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'staff');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function water_station.handle_new_user();

-- Staff-safe price list (no cost columns).
create or replace view water_station.products_public as
  select code, name, price, sort_order from water_station.products where active;
revoke all on water_station.products_public from anon;
grant select on water_station.products_public to authenticated;

-- ───────────────────────── Row Level Security ─────────────────────────

alter table water_station.profiles            enable row level security;
alter table water_station.customers           enable row level security;
alter table water_station.inventory_items     enable row level security;
alter table water_station.products            enable row level security;
alter table water_station.orders              enable row level security;
alter table water_station.order_costs         enable row level security;
alter table water_station.order_items         enable row level security;
alter table water_station.qr_tags             enable row level security;
alter table water_station.expense_categories  enable row level security;
alter table water_station.expenses            enable row level security;

drop policy if exists profiles_read on water_station.profiles;
create policy profiles_read   on water_station.profiles for select to authenticated using (true);
drop policy if exists profiles_admin on water_station.profiles;
create policy profiles_admin  on water_station.profiles for all    to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

drop policy if exists customers_read on water_station.customers;
create policy customers_read   on water_station.customers for select to authenticated using (true);
drop policy if exists customers_insert on water_station.customers;
create policy customers_insert on water_station.customers for insert to authenticated with check (true);
drop policy if exists customers_update on water_station.customers;
create policy customers_update on water_station.customers for update to authenticated using (true) with check (true);
drop policy if exists customers_admin on water_station.customers;
create policy customers_admin  on water_station.customers for delete to authenticated using (water_station.is_admin());

drop policy if exists inventory_admin on water_station.inventory_items;
create policy inventory_admin  on water_station.inventory_items for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists products_admin on water_station.products;
create policy products_admin   on water_station.products        for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

-- Staff can read orders and lines; every write goes through the functions below.
drop policy if exists orders_read on water_station.orders;
create policy orders_read      on water_station.orders      for select to authenticated using (true);
drop policy if exists orders_admin on water_station.orders;
create policy orders_admin     on water_station.orders      for all    to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists items_read on water_station.order_items;
create policy items_read       on water_station.order_items for select to authenticated using (true);
drop policy if exists items_admin on water_station.order_items;
create policy items_admin      on water_station.order_items for all    to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists costs_admin on water_station.order_costs;
create policy costs_admin      on water_station.order_costs for all    to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

drop policy if exists tags_read on water_station.qr_tags;
create policy tags_read        on water_station.qr_tags for select to authenticated using (true);
drop policy if exists tags_admin on water_station.qr_tags;
create policy tags_admin       on water_station.qr_tags for all    to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

drop policy if exists categories_admin on water_station.expense_categories;
create policy categories_admin on water_station.expense_categories for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists expenses_admin on water_station.expenses;
create policy expenses_admin   on water_station.expenses           for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

-- ───────────────────────── Order workflow functions ─────────────────────────
-- p_items example: [{"code":"slim_5gal","qty":3}]

create or replace function water_station.create_order(p_customer_id uuid, p_items jsonb, p_paid boolean default false)
returns uuid
language plpgsql security definer set search_path = water_station as $$
declare
  v_order uuid; v_total numeric := 0; v_cogs numeric := 0;
  it jsonb; prod water_station.products%rowtype; v_qty int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into orders (customer_id, total_amount, created_by, payment_status, paid_at)
  values (p_customer_id, 0, auth.uid(),
          case when p_paid then 'paid' else 'unpaid' end,
          case when p_paid then now() end)
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    continue when v_qty is null or v_qty <= 0;
    select * into prod from products where code = it->>'code' and active;
    if not found then raise exception 'Unknown product %', it->>'code'; end if;
    insert into order_items (order_id, container_type, quantity, unit_price)
    values (v_order, prod.code, v_qty, prod.price);
    v_total := v_total + prod.price * v_qty;
    v_cogs  := v_cogs  + prod.cogs_total * v_qty;
  end loop;

  if v_total <= 0 then raise exception 'Add at least one item'; end if;

  update orders set total_amount = v_total where id = v_order;
  insert into order_costs (order_id, cogs_amount) values (v_order, v_cogs);
  return v_order;
end $$;

create or replace function water_station.assign_tag(p_order_id uuid, p_tag text)
returns void
language plpgsql security definer set search_path = water_station as $$
declare t water_station.qr_tags%rowtype; o water_station.orders%rowtype; v_tag text := upper(trim(p_tag));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into t from qr_tags where tag_code = v_tag for update;
  if not found or not t.enabled then raise exception '% is not a registered tag', v_tag; end if;
  if t.active_order_id is not null then raise exception '% is already linked to another order', v_tag; end if;
  select * into o from orders where id = p_order_id for update;
  if not found or o.status <> 'pending' then raise exception 'Only pending orders can get a tag'; end if;
  if exists (select 1 from qr_tags where active_order_id = o.id) then raise exception 'This order already has a tag'; end if;
  update qr_tags set active_order_id = o.id where tag_code = v_tag;
  update orders set qr_tag_id = v_tag, updated_at = now() where id = o.id;
end $$;

-- Core scan-to-state step. Returns what happened so the UI can react.
--   unknown            tag is not registered or is disabled
--   free               tag is registered but not linked to an order
--   dispatched         pending -> out_for_delivery (state changed)
--   confirm_delivery   out_for_delivery; UI must ask, then call complete_order
create or replace function water_station.scan_tag(p_tag text)
returns jsonb
language plpgsql security definer set search_path = water_station as $$
declare
  t water_station.qr_tags%rowtype; o water_station.orders%rowtype;
  v_tag text := upper(trim(p_tag)); v_name text; v_qty int; v_info jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into t from qr_tags where tag_code = v_tag for update;
  if not found or not t.enabled then return jsonb_build_object('action','unknown','tag',v_tag); end if;
  if t.active_order_id is null then return jsonb_build_object('action','free','tag',v_tag); end if;

  select * into o from orders where id = t.active_order_id for update;
  if not found or o.status not in ('pending','out_for_delivery') then
    update qr_tags set active_order_id = null where tag_code = v_tag;  -- stale link, recycle it
    return jsonb_build_object('action','free','tag',v_tag);
  end if;

  select coalesce(name, 'Walk-in') into v_name from customers where id = o.customer_id;
  select coalesce(sum(quantity), 0) into v_qty from order_items where order_id = o.id;
  v_info := jsonb_build_object(
    'tag', v_tag, 'order_id', o.id, 'order_number', o.order_number,
    'customer', coalesce(v_name, 'Walk-in'), 'total', o.total_amount,
    'quantity', v_qty, 'payment_status', o.payment_status);

  if o.status = 'pending' then
    update orders set status = 'out_for_delivery', dispatched_at = now(), updated_at = now() where id = o.id;
    return v_info || jsonb_build_object('action','dispatched');
  end if;
  return v_info || jsonb_build_object('action','confirm_delivery');
end $$;

-- Completion: delivered, optionally paid, tag recycled, balances and stock updated.
create or replace function water_station.complete_order(p_order_id uuid, p_empties int default null, p_paid boolean default true)
returns void
language plpgsql security definer set search_path = water_station as $$
declare o water_station.orders%rowtype; v_qty int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'out_for_delivery' then raise exception 'Order is not out for delivery'; end if;

  select coalesce(sum(quantity), 0) into v_qty from order_items where order_id = o.id;

  update orders set
    status = 'delivered', delivered_at = now(), updated_at = now(),
    payment_status = case when o.payment_status = 'paid' or p_paid then 'paid' else 'unpaid' end,
    paid_at = case when o.payment_status = 'unpaid' and p_paid then now() else o.paid_at end
  where id = o.id;

  update qr_tags set active_order_id = null where active_order_id = o.id;

  -- containers handed out minus empties brought back
  update customers set container_balance = container_balance + v_qty - coalesce(p_empties, v_qty)
  where id = o.customer_id;

  update inventory_items ii set stock_quantity = ii.stock_quantity - x.q
  from (
    select p.inventory_item_id as iid, sum(oi.quantity) as q
    from order_items oi join products p on p.code = oi.container_type
    where oi.order_id = o.id and p.inventory_item_id is not null
    group by p.inventory_item_id
  ) x
  where ii.id = x.iid;
end $$;

create or replace function water_station.mark_paid(p_order_id uuid)
returns void
language plpgsql security definer set search_path = water_station as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now()
  where id = p_order_id and status <> 'cancelled' and payment_status = 'unpaid';
end $$;

create or replace function water_station.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = water_station as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update orders set status = 'cancelled', updated_at = now()
  where id = p_order_id and status in ('pending','out_for_delivery');
  update qr_tags set active_order_id = null where active_order_id = p_order_id;
end $$;

-- ───────────────────────── Admin reports ─────────────────────────
-- Both return no rows for non-admins.
-- gross_revenue = delivered orders (by delivery month, Manila time)
-- est_cogs      = sum of per-order unit cost estimates (water, power, caps, delivery share)
-- recorded_expenses = actual entries in `expenses`
-- net_margin    = gross_revenue - recorded_expenses  (est_cogs is shown for comparison, not subtracted twice)

create or replace function water_station.monthly_report(p_months int default 6)
returns table (month date, gallons bigint, gross_revenue numeric, est_cogs numeric, recorded_expenses numeric, net_margin numeric)
language sql security definer stable set search_path = water_station as $$
  with span as (
    select generate_series(
      date_trunc('month', timezone('Asia/Manila', now())) - make_interval(months => greatest(p_months, 1) - 1),
      date_trunc('month', timezone('Asia/Manila', now())),
      interval '1 month')::date as mo
  ),
  sales as (
    select date_trunc('month', timezone('Asia/Manila', o.delivered_at))::date as mo,
           sum(o.total_amount) as rv, sum(coalesce(c.cogs_amount, 0)) as cg
    from orders o left join order_costs c on c.order_id = o.id
    where o.status = 'delivered' group by 1
  ),
  units as (
    select date_trunc('month', timezone('Asia/Manila', o.delivered_at))::date as mo, sum(i.quantity) as g
    from orders o join order_items i on i.order_id = o.id
    where o.status = 'delivered' group by 1
  ),
  spend as (
    select date_trunc('month', expense_date)::date as mo, sum(amount) as ex from expenses group by 1
  )
  select mo, coalesce(units.g, 0)::bigint, coalesce(sales.rv, 0), coalesce(sales.cg, 0),
         coalesce(spend.ex, 0), coalesce(sales.rv, 0) - coalesce(spend.ex, 0)
  from span left join sales using (mo) left join units using (mo) left join spend using (mo)
  where water_station.is_admin()
  order by mo;
$$;

create or replace function water_station.today_summary()
returns table (orders_count bigint, gallons bigint, revenue numeric, unpaid_total numeric, pending_count bigint, out_count bigint)
language sql security definer stable set search_path = water_station as $$
  with t as (select timezone('Asia/Manila', date_trunc('day', timezone('Asia/Manila', now()))) as s)
  select
    (select count(*) from orders, t where status = 'delivered' and delivered_at >= t.s),
    (select coalesce(sum(i.quantity), 0) from orders o join order_items i on i.order_id = o.id, t where o.status = 'delivered' and o.delivered_at >= t.s),
    (select coalesce(sum(total_amount), 0) from orders, t where status = 'delivered' and delivered_at >= t.s),
    (select coalesce(sum(total_amount), 0) from orders where status = 'delivered' and payment_status = 'unpaid'),
    (select count(*) from orders where status = 'pending'),
    (select count(*) from orders where status = 'out_for_delivery')
  where water_station.is_admin();
$$;

grant execute on function water_station.create_order(uuid, jsonb, boolean), water_station.assign_tag(uuid, text),
  water_station.scan_tag(text), water_station.complete_order(uuid, int, boolean), water_station.mark_paid(uuid),
  water_station.cancel_order(uuid), water_station.monthly_report(int), water_station.today_summary() to authenticated;
revoke execute on function water_station.create_order(uuid, jsonb, boolean), water_station.assign_tag(uuid, text),
  water_station.scan_tag(text), water_station.complete_order(uuid, int, boolean), water_station.mark_paid(uuid),
  water_station.cancel_order(uuid), water_station.monthly_report(int), water_station.today_summary() from anon;

-- ───────────────────────── Starter data (placeholders: edit in Settings) ─────────────────────────

insert into water_station.inventory_items (item_name, stock_quantity, unit_cost, reorder_level) values
  ('Caps & Seals', 500, 1.50, 100),
  ('Sediment Filter 5u', 10, 250, 3)
on conflict (item_name) do nothing;

insert into water_station.products (code, name, price, cogs_water, cogs_power, cogs_caps, cogs_delivery, inventory_item_id, sort_order)
select v.code, v.name, v.price, v.w, v.p, v.c, v.d, (select id from water_station.inventory_items where item_name = 'Caps & Seals'), v.so
from (values
  ('slim_5gal',     '5-Gal Slim',      35, 5, 3, 1.5, 4, 1),
  ('round_5gal',    '5-Gal Round',     35, 5, 3, 1.5, 4, 2),
  ('19l_dispenser', '19L Dispenser',   30, 4, 2.5, 1.5, 4, 3)
)
 as v(code, name, price, w, p, c, d, so)
on conflict (code) do nothing;

insert into water_station.expense_categories (name) values ('Electricity'), ('Water Intake'), ('Salary'), ('Maintenance')
on conflict (name) do nothing;

insert into water_station.qr_tags (tag_code)
select 'TAG-' || lpad(g::text, 3, '0') from generate_series(1, 50) g
on conflict (tag_code) do nothing;

-- ───────────────────────── Make yourself the first admin ─────────────────────────
-- 1. Create your user in Supabase Auth (Dashboard > Authentication > Users).
-- 2. Run:
--    update water_station.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'you@example.com');
