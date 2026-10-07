-- Daily order status for an explicit date range (Manila dates, inclusive), newest first.
-- Same columns as daily_orders; range is capped at 366 days. Admin only. Re-runnable.

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

grant execute on function water_station.daily_orders_range(date, date) to authenticated;
revoke execute on function water_station.daily_orders_range(date, date) from anon;
