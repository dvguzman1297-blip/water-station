import { createClient } from "@/lib/supabase/server";
import { getCustomerList, getPublicProducts } from "@/lib/cached";
import { OrderBoard } from "@/components/pos/order-board";
import type { Customer, OrderRow, PublicProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StaffDashboard() {
  // No auth lookup here: middleware already requires a session and RLS guards the queries.
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 864e5).toISOString();

  const cols =
    "id, order_number, total_amount, status, payment_status, qr_tag_id, created_at, empties_returned, customers(name, phone, address), order_items(container_type, quantity)";
  const [orders, products, customers, owing] = await Promise.all([
    supabase
      .from("orders")
      .select(cols)
      .or(
        `status.in.(pending,out_for_delivery),and(status.eq.delivered,or(delivered_at.gte.${since},payment_status.eq.unpaid))`
      )
      .order("created_at", { ascending: false })
      .limit(200),
    // Rarely change, so served from the server cache (see lib/cached.ts).
    getPublicProducts().then((data) => ({ data, error: null })).catch((e: Error) => ({ data: null, error: e })),
    getCustomerList().then((data) => ({ data, error: null })).catch((e: Error) => ({ data: null, error: e })),
    // Older deliveries that still have gallons out stay on the Delivered tab until settled.
    supabase
      .from("orders")
      .select(`${cols.replace("customers(", "customers!inner(").replace("address)", "address, container_balance)")}`)
      .eq("status", "delivered")
      .gt("customers.container_balance", 0)
      .order("delivered_at", { ascending: true })
      .limit(200),
  ]);

  const seen = new Set((orders.data ?? []).map((o: any) => o.id));
  const merged = [...(orders.data ?? []), ...((owing.data ?? []) as any[]).filter(
      (o) => !seen.has(o.id) && o.order_items.reduce((n: number, i: any) => n + i.quantity, 0) > (o.empties_returned ?? Infinity)
    ),
  ];

  return (
    <OrderBoard
      orders={merged as unknown as OrderRow[]}
      products={(products.data ?? []) as PublicProduct[]}
      customers={(customers.data ?? []) as Customer[]}
      loadError={orders.error?.message ?? products.error?.message ?? owing.error?.message ?? null}
    />
  );
}
