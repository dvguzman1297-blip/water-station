-- Editing an order can also change its payment: p_paid true = paid, false = unpaid, null = leave as is.
-- Re-runnable. Replaces the 3-argument update_order from 0008.

drop function if exists water_station.update_order(uuid, uuid, jsonb);

create or replace function water_station.update_order(p_order_id uuid, p_customer_id uuid, p_items jsonb, p_paid boolean default null)
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

  update orders set
    customer_id = p_customer_id,
    total_amount = v_total,
    payment_status = case when p_paid is null then payment_status when p_paid then 'paid' else 'unpaid' end,
    paid_at = case when p_paid is null then paid_at when p_paid then coalesce(paid_at, now()) else null end,
    updated_at = now()
  where id = o.id;
  insert into order_costs (order_id, cogs_amount) values (o.id, v_cogs)
  on conflict (order_id) do update set cogs_amount = excluded.cogs_amount;
end $$;

grant execute on function water_station.update_order(uuid, uuid, jsonb, boolean) to authenticated;
revoke execute on function water_station.update_order(uuid, uuid, jsonb, boolean) from anon;

notify pgrst, 'reload schema';
