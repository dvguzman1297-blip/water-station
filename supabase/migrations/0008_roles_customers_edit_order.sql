-- Staff are limited to Orders and Customers (names only). Admins keep everything.
-- Adds customer remarks, order editing, and removes order cancelling. Re-runnable.

-- 1. Take back staff access to the other modules (reads of orders/tags stay open: the order board needs them).
drop policy if exists inventory_admin on water_station.inventory_items;
create policy inventory_admin  on water_station.inventory_items for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists products_admin on water_station.products;
create policy products_admin   on water_station.products        for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists orders_admin on water_station.orders;
create policy orders_admin     on water_station.orders      for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists items_admin on water_station.order_items;
create policy items_admin      on water_station.order_items for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists costs_admin on water_station.order_costs;
create policy costs_admin      on water_station.order_costs for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists tags_admin on water_station.qr_tags;
create policy tags_admin       on water_station.qr_tags for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists categories_admin on water_station.expense_categories;
create policy categories_admin on water_station.expense_categories for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());
drop policy if exists expenses_admin on water_station.expenses;
create policy expenses_admin   on water_station.expenses for all to authenticated using (water_station.is_admin()) with check (water_station.is_admin());

-- Reports are admin-only again.
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

create or replace function water_station.daily_orders(p_days int default 14)
returns table (day date, total_orders bigint, fulfilled bigint, sales numeric)
language sql stable security definer set search_path = water_station as $$
  select d::date,
         count(o.id) filter (where o.status <> 'cancelled'),
         count(o.id) filter (where o.status = 'delivered'),
         coalesce(sum(o.total_amount) filter (where o.status = 'delivered'), 0)
  from generate_series(
         timezone('Asia/Manila', now())::date - (greatest(p_days, 1) - 1),
         timezone('Asia/Manila', now())::date, interval '1 day') d
  left join orders o on timezone('Asia/Manila', o.created_at)::date = d::date
  where water_station.is_admin()
  group by d
  order by d desc;
$$;

create or replace function water_station.daily_orders_range(p_from date, p_to date)
returns table (day date, total_orders bigint, fulfilled bigint, sales numeric)
language sql stable security definer set search_path = water_station as $$
  select d::date,
         count(o.id) filter (where o.status <> 'cancelled'),
         count(o.id) filter (where o.status = 'delivered'),
         coalesce(sum(o.total_amount) filter (where o.status = 'delivered'), 0)
  from generate_series(greatest(p_from, p_to - 365), p_to, interval '1 day') d
  left join orders o on timezone('Asia/Manila', o.created_at)::date = d::date
  where water_station.is_admin()
  group by d
  order by d desc;
$$;


-- 2. Customer details live in their own admin-only table, so staff can read names and nothing else.
create table if not exists water_station.customer_details (
  customer_id uuid primary key references water_station.customers(id) on delete cascade,
  phone text,
  address text,
  remarks text
);
alter table water_station.customer_details enable row level security;
drop policy if exists customer_details_admin on water_station.customer_details;
create policy customer_details_admin on water_station.customer_details for all to authenticated
  using (water_station.is_admin()) with check (water_station.is_admin());

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'water_station' and table_name = 'customers' and column_name = 'phone') then
    insert into water_station.customer_details (customer_id, phone, address)
    select id, phone, address from water_station.customers
    where phone is not null or address is not null
    on conflict (customer_id) do nothing;
    alter table water_station.customers drop column phone, drop column address;
  end if;
end $$;

-- 3. Cancelling is gone.
drop function if exists water_station.cancel_order(uuid);

-- 4. Edit an order that has not been delivered yet: customer and items. Totals and cost are recalculated.
-- Lines keep their original price; a gallon type added during the edit uses the current price.
create or replace function water_station.update_order(p_order_id uuid, p_customer_id uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = water_station as $$
declare
  o water_station.orders%rowtype; it jsonb; prod water_station.products%rowtype;
  v_qty int; v_price numeric; v_total numeric := 0; v_cogs numeric := 0; v_lines jsonb := '[]'::jsonb;
begin
  if not water_station.is_staff() then raise exception 'Not allowed'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('pending', 'out_for_delivery') then raise exception 'Only orders that are not yet delivered can be edited'; end if;
  if p_customer_id is not null and not exists (select 1 from customers where id = p_customer_id) then
    raise exception 'Customer not found';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Add at least one item'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    continue when v_qty is null or v_qty <= 0;
    select * into prod from products where code = it->>'code';
    if not found then raise exception 'Unknown product %', it->>'code'; end if;
    v_price := null;
    select unit_price into v_price from order_items where order_id = o.id and container_type = prod.code limit 1;
    if v_price is null then
      if not prod.active then raise exception '% is not available', prod.name; end if;
      v_price := prod.price;
    end if;
    v_lines := v_lines || jsonb_build_object('code', prod.code, 'qty', v_qty, 'price', v_price);
    v_total := v_total + v_price * v_qty;
    v_cogs  := v_cogs  + prod.cogs_total * v_qty;
  end loop;
  if v_total <= 0 then raise exception 'Add at least one item'; end if;

  delete from order_items where order_id = o.id;
  for it in select * from jsonb_array_elements(v_lines) loop
    insert into order_items (order_id, container_type, quantity, unit_price)
    values (o.id, it->>'code', (it->>'qty')::int, (it->>'price')::numeric);
  end loop;

  update orders set customer_id = p_customer_id, total_amount = v_total, updated_at = now() where id = o.id;
  insert into order_costs (order_id, cogs_amount) values (o.id, v_cogs)
  on conflict (order_id) do update set cogs_amount = excluded.cogs_amount;
end $$;

grant execute on function water_station.update_order(uuid, uuid, jsonb) to authenticated;
revoke execute on function water_station.update_order(uuid, uuid, jsonb) from anon;
grant execute on function water_station.monthly_report(int), water_station.today_summary(),
  water_station.daily_orders(int), water_station.daily_orders_range(date, date) to authenticated;
revoke execute on function water_station.monthly_report(int), water_station.today_summary(),
  water_station.daily_orders(int), water_station.daily_orders_range(date, date) from anon;

notify pgrst, 'reload schema';
