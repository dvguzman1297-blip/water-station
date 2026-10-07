-- Settling unreturned gallons: a log of empties handed back after delivery, plus a function
-- that lowers the customer's container_balance. Re-runnable.

create table if not exists water_station.container_returns (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references water_station.customers(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_by uuid references water_station.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists container_returns_customer_idx on water_station.container_returns(customer_id);

alter table water_station.container_returns enable row level security;
drop policy if exists returns_read on water_station.container_returns;
create policy returns_read on water_station.container_returns for select to authenticated using (true);

-- Lowers the balance by at most what the customer owes (never below zero) and logs what was applied.
create or replace function water_station.settle_containers(p_customer_id uuid, p_qty int)
returns int
language plpgsql security definer set search_path = water_station as $$
declare v_bal int; v_apply int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Enter how many gallons came back'; end if;
  select container_balance into v_bal from customers where id = p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;
  v_apply := least(p_qty, greatest(v_bal, 0));
  if v_apply <= 0 then raise exception 'This customer has no unreturned gallons'; end if;
  update customers set container_balance = container_balance - v_apply where id = p_customer_id;
  insert into container_returns (customer_id, quantity, created_by) values (p_customer_id, v_apply, auth.uid());
  return v_apply;
end $$;

grant execute on function water_station.settle_containers(uuid, int) to authenticated;
revoke execute on function water_station.settle_containers(uuid, int) from anon;

notify pgrst, 'reload schema';
