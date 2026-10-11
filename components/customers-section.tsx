import { createClient } from "@/lib/supabase/server";
import { CustomersView, type CustomerRow } from "@/components/customers-view";

/** Loads customers for the current user. Staff only ever get the name: phone, address, remarks and gallon balance are admin-only. */
export async function CustomersSection({ isAdmin, showTitle = true }: { isAdmin: boolean; showTitle?: boolean }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(isAdmin ? "id, name, container_balance, customer_details(phone, address, remarks)" : "id, name")
    .order("name")
    .limit(2000);

  const rows: CustomerRow[] = ((data ?? []) as any[]).map((c) => {
    const d = Array.isArray(c.customer_details) ? c.customer_details[0] : c.customer_details;
    return {
      id: c.id,
      name: c.name,
      phone: d?.phone ?? "",
      address: d?.address ?? "",
      remarks: d?.remarks ?? "",
      balance: Number(c.container_balance ?? 0),
    };
  });

  return <CustomersView rows={rows} isAdmin={isAdmin} showTitle={showTitle} loadError={error?.message ?? null} />;
}
