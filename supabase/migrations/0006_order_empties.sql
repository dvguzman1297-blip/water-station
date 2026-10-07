-- Track empties per order so unreturned gallons can be listed and settled order by order.
-- orders.empties_returned = empties handed back for that order (at delivery or settled later).
-- Outstanding for an order = gallons ordered - empties_returned. Re-runnable.

alter table water_station.orders add column if not exists empties_returned integer;
alter table water_station.container_returns add column if not exists order_id uuid references water_station.orders(id) on delete set null;

-- Orders delivered before this migration have no per-order record: assume returned.
-- Any balance a customer still owes from those shows up as "earlier balance" in Reports.
update water_station.orders o set empties_returned = coalesce(
  (select sum(quantity) from water_station.order_items i where i.order_id = o.id), 0)
where status = 'delivered' and empties_returned is null;

-- complete_order: same as before, plus it records empties on the order.
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
    empties_returned = coalesce(p_empties, v_qty),
    payment_status = case when o.payment_status = 'paid' or p_paid then 'paid' else 'unpaid' end,
    paid_at = case when o.payment_status = 'unpaid' and p_paid then now() else o.paid_at end
  where id = o.id;

  update qr_tags set active_order_id = null where active_order_id = o.id;

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

-- Settle empties against one delivered order. Applies at most what is still outstanding on it.
create or replace function water_station.settle_order_containers(p_order_id uuid, p_qty int)
returns int
language plpgsql security definer set search_path = water_station as $$
declare o water_station.orders%rowtype; v_qty int; v_owed int; v_apply int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter how many gallons came back'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found or o.status <> 'delivered' or o.customer_id is null then raise exception 'Order not found'; end if;
  select coalesce(sum(quantity), 0) into v_qty from order_items where order_id = o.id;
  v_owed := v_qty - coalesce(o.empties_returned, 0);
  v_apply := least(p_qty, v_owed);
  if v_apply <= 0 then raise exception 'Nothing left to return on this order'; end if;
  update orders set empties_returned = coalesce(empties_returned, 0) + v_apply, updated_at = now() where id = o.id;
  update customers set container_balance = container_balance - v_apply where id = o.customer_id;
  insert into container_returns (customer_id, order_id, quantity, created_by)
  values (o.customer_id, o.id, v_apply, auth.uid());
  return v_apply;
end $$;

grant execute on function water_station.complete_order(uuid, int, boolean) to authenticated;
grant execute on function water_station.settle_order_containers(uuid, int) to authenticated;
revoke execute on function water_station.settle_order_containers(uuid, int) from anon;

notify pgrst, 'reload schema';
