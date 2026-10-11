-- Staff may add customers but not rename or delete them. Re-runnable.
-- (Order workflow functions are security definer, so gallon balances still update.)

drop policy if exists customers_update on water_station.customers;
create policy customers_update on water_station.customers for update to authenticated
  using (water_station.is_admin()) with check (water_station.is_admin());

drop policy if exists customers_admin on water_station.customers;
create policy customers_admin on water_station.customers for delete to authenticated
  using (water_station.is_admin());

notify pgrst, 'reload schema';
