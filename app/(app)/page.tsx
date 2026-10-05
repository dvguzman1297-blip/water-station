import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { OrderBoard } from "@/components/pos/order-board";
import type { Customer, OrderRow, PublicProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  await getProfile();
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 864e5).toISOString();

  const [orders, products, customers] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, total_amount, status, payment_status, qr_tag_id, created_at, customers(name, phone, address), order_items(container_type, quantity)"
      )
      .or(
        `status.in.(pending,out_for_delivery),and(status.eq.delivered,or(delivered_at.gte.${since},payment_status.eq.unpaid))`
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("products_public").select("code, name, price").order("sort_order"),
    supabase.from("customers").select("id, name, phone, address").order("name").limit(1000),
  ]);

  return (
    <OrderBoard
      orders={(orders.data ?? []) as unknown as OrderRow[]}
      products={(products.data ?? []) as PublicProduct[]}
      customers={(customers.data ?? []) as Customer[]}
      loadError={orders.error?.message ?? products.error?.message ?? null}
    />
  );
}
