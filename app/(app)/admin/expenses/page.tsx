import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addExpense, deleteExpense } from "../actions";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/flash";
import { peso } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const supabase = await createClient();
  const [cats, list] = await Promise.all([
    supabase.from("expense_categories").select("name").order("name"),
    supabase.from("expenses").select("id, category, amount, expense_date, notes").order("expense_date", { ascending: false }).limit(60),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const monthPrefix = today.slice(0, 7);
  const monthTotal = (list.data ?? []).filter((e) => e.expense_date.startsWith(monthPrefix)).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Expenses</h1>
      <Flash error={error} />

      <form action={addExpense} className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" className="field" required>
            {(cats.data ?? []).map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount (₱)</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" inputMode="decimal" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="expense_date">Date</label>
          <input id="expense_date" name="expense_date" type="date" defaultValue={today} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Note (optional)</label>
          <input id="notes" name="notes" className="field" />
        </div>
        <Button type="submit" size="lg" className="sm:col-span-2">Add expense</Button>
      </form>

      <p className="text-lg font-semibold">This month so far: {peso(monthTotal)}</p>

      <ul className="space-y-2">
        {(list.data ?? []).map((e) => (
          <li key={e.id} className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
            <div>
              <p className="font-bold">{e.category} · {peso(Number(e.amount))}</p>
              <p className="text-sm text-navy/60">{e.expense_date}{e.notes ? ` · ${e.notes}` : ""}</p>
            </div>
            <form action={deleteExpense}>
              <input type="hidden" name="id" value={e.id} />
              <Button variant="ghost" size="sm" type="submit">Delete</Button>
            </form>
          </li>
        ))}
        {(list.data ?? []).length === 0 && <li className="glass rounded-2xl p-6 text-center text-navy/60">No expenses recorded yet.</li>}
      </ul>
    </div>
  );
}
