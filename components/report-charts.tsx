"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { peso } from "@/lib/utils";

export type MonthRow = {
  month: string;
  gallons: number;
  gross_revenue: number;
  est_cogs: number;
  recorded_expenses: number;
  net_margin: number;
};

const label = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", year: "2-digit" });

export function ReportCharts({ rows }: { rows: MonthRow[] }) {
  const data = rows.map((r) => ({ ...r, name: label(r.month) }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass rounded-2xl p-4" aria-label="Gallons sold by month">
        <h2 className="mb-2 text-lg font-bold">Gallons sold</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a22" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="gallons" name="Gallons" stroke="#0284c7" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="glass rounded-2xl p-4" aria-label="Revenue, expenses and net margin by month">
        <h2 className="mb-2 text-lg font-bold">Revenue, expenses, net margin</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a22" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
              <Tooltip formatter={(v: number) => peso(v)} />
              <Legend />
              <Bar dataKey="gross_revenue" name="Gross revenue" fill="#0284c7" radius={[6, 6, 0, 0]} />
              <Bar dataKey="recorded_expenses" name="Expenses" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="net_margin" name="Net margin" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
