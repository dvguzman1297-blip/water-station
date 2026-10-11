-- Staff get every feature except account controls (profiles stay admin-only).
-- Adds deleting orders and customers. Re-runnable.

create or replace function water_station.is_staff() returns boolean
language sql security definer stable set search_path = water_station as $$
  select exists (select 1 from water_station.profiles where id = auth.uid());
$$;

-- Open the former admin-only tables to any signed-in team member.
drop policy if exists customers_admin on water_station.customers;
create policy customers_admin  on water_station.customers for delete to authenticated using (water_station.is_staff());

drop policy if exists inventory_admin on water_station.inventory_items;
create policy inventory_admin  on water_station.inventory_items for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists products_admin on water_station.products;
create policy products_admin   on water_station.products        for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists orders_admin on water_station.orders;
create policy orders_admin     on water_station.orders      for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists items_admin on water_station.order_items;
create policy items_admin      on water_station.order_items for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists costs_admin on water_station.order_costs;
create policy costs_admin      on water_station.order_costs for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists tags_admin on water_station.qr_tags;
create policy tags_admin       on water_station.qr_tags for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists categories_admin on water_station.expense_categories;
create policy categories_admin on water_station.expense_categories for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
drop policy if exists expenses_admin on water_station.expenses;
create policy expenses_admin   on water_station.expenses for all to authenticated using (water_station.is_staff()) with check (water_station.is_staff());
-- profiles_admin is untouched: only admins can create, edit or remove accounts.

-- Deleting a customer keeps their orders; those become walk-ins.
alter table water_station.orders drop constraint if exists orders_customer_id_fkey;
alter table water_station.orders
  add constraint orders_customer_id_fkey foreign key (customer_id)
  references water_station.customers(id) on delete set null;

-- Reports: same queries, now open to staff. Dropped first because the return shape may differ from the live version.
drop function if exists water_station.monthly_report(int);
drop function if exists water_station.today_summary();
drop function if exists water_station.daily_orders(int);
drop function if exists water_station.daily_orders_range(date, date);

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
  where water_station.is_staff()
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
  where water_station.is_staff();
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
  where water_station.is_staff()
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
  where water_station.is_staff()
  group by d
  order by d desc;
$$;

-- Delete an order for good. Undoes what delivery did (gallons still out, stock used) so totals stay right.
create or replace function water_station.delete_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = water_station as $$
declare o water_station.orders%rowtype; v_qty int;
begin
  if not water_station.is_staff() then raise exception 'Not allowed'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if o.status = 'delivered' then
    select coalesce(sum(quantity), 0) into v_qty from order_items where order_id = o.id;
    update customers set container_balance = greatest(container_balance - (v_qty - coalesce(o.empties_returned, v_qty)), 0)
    where id = o.customer_id;
    update inventory_items ii set stock_quantity = ii.stock_quantity + x.q
    from (
      select p.inventory_item_id as iid, sum(oi.quantity) as q
      from order_items oi join products p on p.code = oi.container_type
      where oi.order_id = o.id and p.inventory_item_id is not null
      group by p.inventory_item_id
    ) x
    where ii.id = x.iid;
  end if;

  delete from qr_tags where active_order_id = o.id or tag_code = o.qr_tag_id and tag_code like 'ORD-%';
  delete from orders where id = o.id;   -- order_items and order_costs cascade
end $$;

grant execute on function water_station.is_staff(), water_station.delete_order(uuid) to authenticated;
revoke execute on function water_station.is_staff(), water_station.delete_order(uuid) from anon;

grant execute on function water_station.monthly_report(int), water_station.today_summary(),
  water_station.daily_orders(int), water_station.daily_orders_range(date, date) to authenticated;
revoke execute on function water_station.monthly_report(int), water_station.today_summary(),
  water_station.daily_orders(int), water_station.daily_orders_range(date, date) from anon;

notify pgrst, 'reload schema';
