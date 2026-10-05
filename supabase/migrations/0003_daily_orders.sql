-- Daily order status: one row per day (Manila time, by order date) for the last p_days days.
-- total_orders excludes cancelled orders; fulfilled = delivered; sales = value of delivered orders.
-- Admin only. Re-runnable.

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

grant execute on function water_station.daily_orders(int) to authenticated;
revoke execute on function water_station.daily_orders(int) from anon;
