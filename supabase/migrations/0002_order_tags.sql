-- Every order gets its own QR tag (ORD-0042) the moment it is created.
-- The tag drives the same scan-to-state flow as before: pending -> out_for_delivery -> delivered.
-- Re-runnable.

create or replace function water_station.create_order(p_customer_id uuid, p_items jsonb, p_paid boolean default false)
returns uuid
language plpgsql security definer set search_path = water_station as $$
declare
  v_order uuid; v_num int; v_tag text; v_total numeric := 0; v_cogs numeric := 0;
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
  returning id, order_number into v_order, v_num;

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

  v_tag := 'ORD-' || lpad(v_num::text, 4, '0');
  insert into qr_tags (tag_code, active_order_id) values (v_tag, v_order);
  update orders set total_amount = v_total, qr_tag_id = v_tag where id = v_order;
  insert into order_costs (order_id, cogs_amount) values (v_order, v_cogs);
  return v_order;
end $$;

-- scan_tag: adds a 'closed' result for an order tag whose order is already delivered or cancelled.
create or replace function water_station.scan_tag(p_tag text)
returns jsonb
language plpgsql security definer set search_path = water_station as $$
declare
  t water_station.qr_tags%rowtype; o water_station.orders%rowtype;
  v_tag text := upper(trim(p_tag)); v_name text; v_qty int; v_info jsonb; v_status text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into t from qr_tags where tag_code = v_tag for update;
  if not found or not t.enabled then return jsonb_build_object('action','unknown','tag',v_tag); end if;

  if t.active_order_id is not null then
    select * into o from orders where id = t.active_order_id for update;
    if not found or o.status not in ('pending','out_for_delivery') then
      update qr_tags set active_order_id = null where tag_code = v_tag;  -- stale link
      o := null;
    end if;
  end if;

  if o.id is null then
    if v_tag like 'ORD-%' then
      select status into v_status from orders where qr_tag_id = v_tag order by created_at desc limit 1;
      return jsonb_build_object('action','closed','tag',v_tag,'status',v_status);
    end if;
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

-- Backfill: give existing orders an ORD tag. Live orders move from their old pool tag to it.
update water_station.qr_tags set active_order_id = null
where tag_code not like 'ORD-%' and active_order_id is not null;

insert into water_station.qr_tags (tag_code, active_order_id)
select 'ORD-' || lpad(o.order_number::text, 4, '0'),
       case when o.status in ('pending','out_for_delivery') then o.id end
from water_station.orders o
where o.qr_tag_id is null or o.qr_tag_id not like 'ORD-%'
on conflict (tag_code) do nothing;

update water_station.orders o set qr_tag_id = 'ORD-' || lpad(o.order_number::text, 4, '0')
where o.qr_tag_id is null or o.qr_tag_id not like 'ORD-%';
