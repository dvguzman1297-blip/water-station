import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReportCharts, type MonthRow } from "@/components/report-charts";
import { Flash } from "@/components/flash";
import { peso } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-sm font-semibold text-navy/60">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone === "warn" ? "text-rose-700" : ""}`}>{value}</p>
    </div>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [monthly, today, daily] = await Promise.all([
    supabase.rpc("monthly_report", { p_months: 6 }),
    supabase.rpc("today_summary"),
    supabase.rpc("daily_orders", { p_days: 14 }),
  ]);
  const days = ((daily.data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    total: Number(r.total_orders),
    fulfilled: Number(r.fulfilled),
    sales: Number(r.sales),
  }));

  const rows: MonthRow[] = (monthly.data ?? []).map((r: any) => ({
    month: r.month,
    gallons: Number(r.gallons),
    gross_revenue: Number(r.gross_revenue),
    est_cogs: Number(r.est_cogs),
    recorded_expenses: Number(r.recorded_expenses),
    net_margin: Number(r.net_margin),
  }));
  const t = (today.data as any[] | null)?.[0];
  const current = rows[rows.length - 1];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <Flash error={monthly.error?.message ?? today.error?.message ?? daily.error?.message} />

      <h2 className="text-lg font-bold">Today</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Gallons delivered" value={String(t?.gallons ?? 0)} />
        <Stat label="Sales" value={peso(Number(t?.revenue ?? 0))} />
        <Stat label="Orders open" value={`${Number(t?.pending_count ?? 0)} pending · ${Number(t?.out_count ?? 0)} out`} />
        <Stat label="Unpaid, all time" value={peso(Number(t?.unpaid_total ?? 0))} tone={Number(t?.unpaid_total ?? 0) > 0 ? "warn" : undefined} />
      </div>

      <h2 className="text-lg font-bold">Orders by day</h2>
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
    </div>
  );
}
