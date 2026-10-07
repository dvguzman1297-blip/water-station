import Link from "next/link";
import { BarChart3, PackageX, Truck, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportCharts, type MonthRow } from "@/components/report-charts";
import { SectionNav } from "@/components/section-nav";
import { Flash } from "@/components/flash";
import { settleContainers, settleOrderContainers } from "../actions";
import { Button } from "@/components/ui/button";
import { peso } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "daily", label: "Orders by day", icon: Truck },
  { id: "cancelled", label: "Cancelled orders", icon: XCircle },
  { id: "gallons", label: "Unreturned gallons", icon: PackageX },
] as const;

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-sm font-semibold text-navy/60">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone === "warn" ? "text-rose-700" : ""}`}>{value}</p>
    </div>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const shiftDay = (iso: string, by: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const PRESETS = [{ label: "7 days", days: 7 }, { label: "14 days", days: 14 }, { label: "30 days", days: 30 }, { label: "90 days", days: 90 }];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; tab?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "overview";
  const today0 = manilaToday();
  let to = sp.to && ISO.test(sp.to) ? sp.to : today0;
  if (to > today0) to = today0;
  let from = sp.from && ISO.test(sp.from) ? sp.from : shiftDay(to, -13);
  if (from > to) [from, to] = [to, from];
  if (from < shiftDay(to, -365)) from = shiftDay(to, -365);
  const isPreset = (n: number) => to === today0 && from === shiftDay(today0, -(n - 1));
  const supabase = await createClient();
  const empty = { data: null, error: null } as { data: any; error: { message: string } | null };

  // Only load what the open tab shows.
  const [monthly, today, daily, cancelled, owing, prods, owingOrders] = await Promise.all([
    tab === "overview" ? supabase.rpc("monthly_report", { p_months: 6 }) : empty,
    tab === "overview" ? supabase.rpc("today_summary") : empty,
    tab === "daily" ? supabase.rpc("daily_orders_range", { p_from: from, p_to: to }) : empty,
    tab === "cancelled"
      ? supabase
          .from("orders")
          .select("id, order_number, created_at, total_amount, payment_status, customers(name), order_items(container_type, quantity)")
          .eq("status", "cancelled")
          .gte("created_at", `${from}T00:00:00+08:00`)
          .lt("created_at", `${shiftDay(to, 1)}T00:00:00+08:00`)
          .order("created_at", { ascending: false })
      : empty,
    tab === "gallons"
      ? supabase.from("customers").select("id, name, phone, address, container_balance").gt("container_balance", 0)
      : empty,
    tab === "cancelled" || tab === "gallons" ? supabase.from("products").select("code, name") : empty,
    tab === "gallons"
      ? supabase
          .from("orders")
          .select("id, order_number, delivered_at, empties_returned, customer_id, customers!inner(name, phone, container_balance), order_items(container_type, quantity)")
          .eq("status", "delivered")
          .gt("customers.container_balance", 0)
          .order("delivered_at", { ascending: true })
      : empty,
  ]);
  const prodName = new Map(((prods.data ?? []) as any[]).map((p) => [p.code, p.name]));
  const owingRows = (owing.data ?? []) as any[];
  const owedTotal = owingRows.reduce((n, c) => n + Number(c.container_balance), 0);
  // One card per delivered order that still has gallons out (oldest first), plus any balance not tied to an order.
  const orderCards = ((owingOrders.data ?? []) as any[])
    .map((o) => {
      const ordered = (o.order_items ?? []).reduce((n: number, i: any) => n + Number(i.quantity), 0);
      return { ...o, ordered, owed: ordered - Number(o.empties_returned ?? 0) };
    })
    .filter((o) => o.owed > 0);
  const tiedByCustomer = new Map<string, number>();
  for (const o of orderCards) tiedByCustomer.set(o.customer_id, (tiedByCustomer.get(o.customer_id) ?? 0) + o.owed);
  const earlierCards = owingRows
    .map((c) => ({ ...c, earlier: Number(c.container_balance) - (tiedByCustomer.get(c.id) ?? 0) }))
    .filter((c) => c.earlier > 0);
  const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  const cancelledRows = (cancelled.data ?? []) as any[];
  const days = ((daily.data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    total: Number(r.total_orders),
    fulfilled: Number(r.fulfilled),
    sales: Number(r.sales),
  }));
  const rows: MonthRow[] = ((monthly.data ?? []) as any[]).map((r) => ({
    month: r.month,
    gallons: Number(r.gallons),
    gross_revenue: Number(r.gross_revenue),
    est_cogs: Number(r.est_cogs),
    recorded_expenses: Number(r.recorded_expenses),
    net_margin: Number(r.net_margin),
  }));
  const t = (today.data as any[] | null)?.[0];
  const current = rows[rows.length - 1];
  const loadError = [monthly, today, daily, cancelled, owing, owingOrders].find((r) => r.error)?.error?.message ?? sp.error;

  const rangeForm = (
    <form method="get" className="glass flex flex-wrap items-end gap-3 rounded-2xl p-3">
      <input type="hidden" name="tab" value={tab} />
      <div>
        <label className="label" htmlFor="from">From</label>
        <input id="from" name="from" type="date" defaultValue={from} max={today0} className="field" required />
      </div>
      <div>
        <label className="label" htmlFor="to">To</label>
        <input id="to" name="to" type="date" defaultValue={to} max={today0} className="field" required />
      </div>
      <Button type="submit">Load data</Button>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {PRESETS.map((p) => (
          <Link
            key={p.days}
            href={`/admin/reports?tab=${tab}&from=${shiftDay(today0, -(p.days - 1))}&to=${today0}`}
            className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${isPreset(p.days) ? "border-ocean bg-ocean/15" : "border-navy/15 bg-white/60 hover:bg-white"}`}
          >
            Last {p.label}
          </Link>
        ))}
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
        <SectionNav base="/admin/reports" tabs={TABS} current={tab} label="Report sections" />
        <div className="min-w-0 space-y-4">
          <Flash error={loadError} />
          {tab === "overview" && (
            <>
              <h2 className="text-lg font-bold">Today</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Gallons delivered" value={String(t?.gallons ?? 0)} />
                <Stat label="Sales" value={peso(Number(t?.revenue ?? 0))} />
                <Stat label="Orders open" value={`${Number(t?.pending_count ?? 0)} pending · ${Number(t?.out_count ?? 0)} out`} />
                <Stat label="Unpaid, all time" value={peso(Number(t?.unpaid_total ?? 0))} tone={Number(t?.unpaid_total ?? 0) > 0 ? "warn" : undefined} />
              </div>
              {current && (
                <>
                  <h2 className="text-lg font-bold">This month</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Stat label="Gallons sold" value={String(current.gallons)} />
                    <Stat label="Gross revenue" value={peso(current.gross_revenue)} />
                    <Stat label="Expenses recorded" value={peso(current.recorded_expenses)} />
                    <Stat label="Net margin" value={peso(current.net_margin)} tone={current.net_margin < 0 ? "warn" : undefined} />
                  </div>
                  <p className="text-sm text-navy/70">
                    Estimated cost of goods this month: {peso(current.est_cogs)}. Net margin is revenue minus the expenses you record,
                    so the estimate is for comparison and is not subtracted again.
                  </p>
                </>
              )}

              <ReportCharts rows={rows} />

              <div className="glass overflow-x-auto rounded-2xl p-2">
                <table className="w-full min-w-[34rem] text-left">
                  <thead>
                    <tr className="text-sm text-navy/60">
                      <th className="p-2">Month</th><th className="p-2">Gallons</th><th className="p-2">Revenue</th>
                      <th className="p-2">Est. COGS</th><th className="p-2">Expenses</th><th className="p-2">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.month} className="border-t border-navy/10 tabular-nums">
                        <td className="p-2 font-semibold">{new Date(r.month + "T00:00:00").toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</td>
                        <td className="p-2">{r.gallons}</td>
                        <td className="p-2">{peso(r.gross_revenue)}</td>
                        <td className="p-2">{peso(r.est_cogs)}</td>
                        <td className="p-2">{peso(r.recorded_expenses)}</td>
                        <td className={`p-2 font-bold ${r.net_margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>{peso(r.net_margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "daily" && (
            <>
              <h2 className="text-lg font-bold">Orders by day</h2>
              {rangeForm}
              <div className="glass overflow-x-auto rounded-2xl p-2">
                <table className="w-full min-w-[26rem] text-left">
                  <thead>
                    <tr className="text-sm text-navy/60">
                      <th className="p-2">Date</th><th className="p-2">Orders</th><th className="p-2">Sales</th><th className="p-2">Fulfilled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.day} className="border-t border-navy/10 tabular-nums">
                        <td className="p-2 font-semibold">{new Date(d.day + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</td>
                        <td className="p-2">{d.total}</td>
                        <td className="p-2">{peso(d.sales)}</td>
                        <td className={`p-2 font-bold ${d.total > 0 && d.fulfilled < d.total ? "text-amber-700" : "text-emerald-700"}`}>
                          {d.fulfilled} / {d.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-navy/70">Grouped by the day the order was placed. Cancelled orders are not counted; sales are delivered orders only.</p>
            </>
          )}
          {tab === "cancelled" && (
            <>
              <h2 className="text-lg font-bold">Cancelled orders</h2>
              {rangeForm}
              <div className="glass overflow-x-auto rounded-2xl p-2">
                <table className="w-full min-w-[30rem] text-left">
                  <thead>
                    <tr className="text-sm text-navy/60">
                      <th className="p-2">Order</th><th className="p-2">Placed</th><th className="p-2">Customer</th><th className="p-2">Items</th><th className="p-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledRows.map((o) => (
                      <tr key={o.id} className="border-t border-navy/10 tabular-nums">
                        <td className="p-2 font-semibold">#{o.order_number}</td>
                        <td className="p-2">{new Date(o.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                        <td className="p-2">{o.customers?.name ?? "Walk-in"}</td>
                        <td className="p-2">{(o.order_items ?? []).map((i: any) => `${i.quantity} × ${prodName.get(i.container_type) ?? i.container_type}`).join(", ")}</td>
                        <td className="p-2">{peso(Number(o.total_amount))}</td>
                      </tr>
                    ))}
                    {cancelledRows.length === 0 && (
                      <tr><td colSpan={5} className="p-3 text-navy/60">No cancelled orders in this date range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "gallons" && (
            <>
              <h2 className="text-lg font-bold">Unreturned gallons</h2>
              <p className="text-sm text-navy/70">
                {owedTotal > 0 ? `${owedTotal} gallon${owedTotal === 1 ? "" : "s"} still out with ${owingRows.length} customer${owingRows.length === 1 ? "" : "s"}. ` : ""}
                One card per delivered order, oldest first. Enter how many came back and press Settle. This list is all-time.
              </p>
              <ul className="grid gap-3 md:grid-cols-2">
                {orderCards.map((o) => {
                  const age = o.delivered_at ? daysSince(o.delivered_at) : 0;
                  return (
                    <li key={o.id} className="glass space-y-3 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold">{o.customers?.name}</p>
                          <p className="text-sm text-navy/60">
                            Order #{o.order_number}
                            {o.delivered_at && ` · delivered ${new Date(o.delivered_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}`}
                            {o.customers?.phone && ` · ${o.customers.phone}`}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${age >= 7 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                          {age === 0 ? "today" : `${age}d`}
                        </span>
                      </div>
                      <p className="text-sm">
                        {(o.order_items ?? []).map((i: any) => `${i.quantity} × ${prodName.get(i.container_type) ?? i.container_type}`).join(", ")}
                      </p>
                      <p className="font-semibold">
                        {o.owed} of {o.ordered} not returned
                        {Number(o.empties_returned ?? 0) > 0 && <span className="font-normal text-navy/60"> · {o.empties_returned} back already</span>}
                      </p>
                      <form action={settleOrderContainers} className="flex items-center gap-2">
                        <input type="hidden" name="order_id" value={o.id} />
                        <input
                          name="qty" type="number" min={1} max={o.owed} defaultValue={o.owed}
                          aria-label={`Gallons returned for order ${o.order_number}`} className="field !h-10 !w-20 text-center"
                        />
                        <Button type="submit" size="sm" className="flex-1">Settle returned gallons</Button>
                      </form>
                    </li>
                  );
                })}
                {earlierCards.map((c) => (
                  <li key={c.id} className="glass space-y-3 rounded-2xl p-4">
                    <div>
                      <p className="truncate text-lg font-bold">{c.name}</p>
                      <p className="text-sm text-navy/60">
                        Earlier balance, not tied to a specific order{c.phone && ` · ${c.phone}`}
                      </p>
                    </div>
                    <p className="font-semibold">{c.earlier} not returned</p>
                    <form action={settleContainers} className="flex items-center gap-2">
                      <input type="hidden" name="customer_id" value={c.id} />
                      <input
                        name="qty" type="number" min={1} max={c.earlier} defaultValue={c.earlier}
                        aria-label={`Gallons returned by ${c.name}`} className="field !h-10 !w-20 text-center"
                      />
                      <Button type="submit" size="sm" className="flex-1">Settle returned gallons</Button>
                    </form>
                  </li>
                ))}
                {orderCards.length + earlierCards.length === 0 && (
                  <li className="glass rounded-2xl p-3 text-navy/60 md:col-span-2">Every gallon is accounted for.</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
