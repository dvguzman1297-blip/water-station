import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/flash";
import { peso } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MarginsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [products, lines] = await Promise.all([
    supabase.from("products").select("code, name, price, cogs_water, cogs_power, cogs_caps, cogs_delivery, cogs_total, active").order("sort_order"),
    supabase.from("order_items").select("container_type, quantity, orders!inner(status, delivered_at)").eq("orders.status", "delivered").gte("orders.delivered_at", since),
  ]);

  const sold: Record<string, number> = {};
  (lines.data ?? []).forEach((l: any) => {
    sold[l.container_type] = (sold[l.container_type] ?? 0) + l.quantity;
  });

  const rows = (products.data ?? []).map((p) => {
    const price = Number(p.price);
    const cogs = Number(p.cogs_total);
    const units = sold[p.code] ?? 0;
    return { ...p, price, cogs, margin: price - cogs, pct: price > 0 ? ((price - cogs) / price) * 100 : 0, units, profit: (price - cogs) * units };
  });
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Margins per gallon</h1>
      <Flash error={products.error?.message ?? lines.error?.message} />
      <p className="text-navy/70">Margin = price minus water intake, power, caps and seals, and delivery share. Change the numbers in Settings.</p>

      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <article key={r.code} className={`glass rounded-2xl p-4 ${r.active ? "" : "opacity-60"}`}>
            <h2 className="text-lg font-bold">{r.name}{r.active ? "" : " (hidden)"}</h2>
            <dl className="mt-2 space-y-1 tabular-nums">
              <div className="flex justify-between"><dt>Price</dt><dd className="font-semibold">{peso(r.price)}</dd></div>
              <div className="flex justify-between text-navy/70"><dt>Water intake</dt><dd>{peso(Number(r.cogs_water))}</dd></div>
              <div className="flex justify-between text-navy/70"><dt>Power</dt><dd>{peso(Number(r.cogs_power))}</dd></div>
              <div className="flex justify-between text-navy/70"><dt>Caps & seals</dt><dd>{peso(Number(r.cogs_caps))}</dd></div>
              <div className="flex justify-between text-navy/70"><dt>Delivery share</dt><dd>{peso(Number(r.cogs_delivery))}</dd></div>
              <div className="flex justify-between border-t border-navy/10 pt-1"><dt>Cost per unit</dt><dd className="font-semibold">{peso(r.cogs)}</dd></div>
              <div className={`flex justify-between text-lg font-bold ${r.margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                <dt>Margin</dt><dd>{peso(r.margin)} ({r.pct.toFixed(0)}%)</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-navy/70">Last 30 days: {r.units} sold, {peso(r.profit)} profit</p>
          </article>
        ))}
      </div>
      <p className="text-lg font-bold">Estimated 30-day unit profit: {peso(totalProfit)}</p>
    </div>
  );
}
