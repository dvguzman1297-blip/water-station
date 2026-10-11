import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getCustomerList, getPublicProducts } from "@/lib/cached";
import { OrderBoard } from "@/components/pos/order-board";
import type { Customer, OrderRow, PublicProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

// Phone, address and remarks come from customer_details, which only admins can read.
// For staff that join is empty, so they only ever get the customer's name.
const CUSTOMER = "customer_details(phone, address, remarks)";
const COLS = (customer: string) =>
  `id, order_number, customer_id, total_amount, status, payment_status, qr_tag_id, created_at, empties_returned, ${customer}, order_items(container_type, quantity)`;

function flatten(rows: any[]): OrderRow[] {
  return rows.map((o) => {
    const c = o.customers;
    const d = Array.isArray(c?.customer_details) ? c.customer_details[0] : c?.customer_details;
    return {
      ...o,
      customers: c ? { name: c.name, phone: d?.phone ?? null, address: d?.address ?? null, remarks: d?.remarks ?? null } : null,
    };
  });
}

export default async function StaffDashboard() {
  const profile = await getProfile();
  const supabase = await createClient();
  const since = new Date(Date.now() - 2 * 864e5).toISOString();

  const [orders, products, customers, owing] = await Promise.all([
    supabase
      .from("orders")
      .select(COLS(`customers(name, ${CUSTOMER})`))
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
      .select(COLS(`customers!inner(name, container_balance, ${CUSTOMER})`))
      .eq("status", "delivered")
      .gt("customers.container_balance", 0)
      .order("delivered_at", { ascending: true })
      .limit(200),
  ]);

  const seen = new Set((orders.data ?? []).map((o: any) => o.id));
  const merged = flatten([
    ...(orders.data ?? []),
    ...((owing.data ?? []) as any[]).filter(
      (o) => !seen.has(o.id) && o.order_items.reduce((n: number, i: any) => n + i.quantity, 0) > (o.empties_returned ?? Infinity)
    ),
  ]);

  return (
    <OrderBoard
      orders={merged}
      products={(products.data ?? []) as PublicProduct[]}
      customers={(customers.data ?? []) as Customer[]}
      isAdmin={profile.role === "admin"}
      loadError={orders.error?.message ?? products.error?.message ?? owing.error?.message ?? null}
    />
  );
}
