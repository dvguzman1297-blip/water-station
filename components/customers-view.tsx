"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCustomer, saveCustomer } from "@/app/actions";

export type CustomerRow = { id: string; name: string; phone: string; address: string; remarks: string; balance: number };
type Draft = { id?: string; name: string; phone: string; address: string; remarks: string };
const EMPTY: Draft = { name: "", phone: "", address: "", remarks: "" };

export function CustomersView({ rows, isAdmin, loadError, showTitle = true }: { rows: CustomerRow[]; isAdmin: boolean; loadError: string | null; showTitle?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.phone.includes(q)) : rows;
  }, [rows, query]);

  const set = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function save() {
    if (!draft) return;
    setError(null);
    start(async () => {
      const res = await saveCustomer(draft);
      if (!res.ok) return setError(res.error);
      setDraft(null);
      router.refresh();
    });
  }

  function remove(r: CustomerRow) {
    if (!confirm(`Permanently delete ${r.name}? Their past orders will show as Walk-in.`)) return;
    setError(null);
    start(async () => {
      const res = await deleteCustomer(r.id);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {showTitle ? <h1 className="text-2xl font-bold">Customers</h1> : <h2 className="text-xl font-bold">Customers</h2>}
        <Button onClick={() => setDraft({ ...EMPTY })}><Plus className="h-5 w-5" /> Add customer</Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">{error}</p>
      )}

      {draft && (
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="glass space-y-3 rounded-2xl p-4"
          aria-label={draft.id ? "Edit customer" : "New customer"}
        >
          <h2 className="text-lg font-bold">{draft.id ? "Edit customer" : "New customer"}</h2>
          <div>
            <label className="label" htmlFor="c-name">Name</label>
            <input id="c-name" className="field" value={draft.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </div>
          {isAdmin && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-phone">Phone</label>
                  <input id="c-phone" className="field" inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-address">Address</label>
                  <input id="c-address" className="field" value={draft.address} onChange={(e) => set("address", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="c-remarks">Remarks</label>
                <textarea
                  id="c-remarks" rows={3} className="field !h-auto py-3" value={draft.remarks}
                  onChange={(e) => set("remarks", e.target.value)} placeholder="Important notes about this customer"
                />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={pending} disabled={!draft.name.trim()}>Save</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/40" />
        <input className="field pl-10" placeholder={isAdmin ? "Search name or phone" : "Search name"} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id} className="glass space-y-2 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{r.name}</p>
                {isAdmin && (
                  <p className="text-sm text-navy/60">
                    {[r.phone, r.address].filter(Boolean).join(" · ") || "No contact details"}
                    {r.balance > 0 && ` · ${r.balance} gallon${r.balance === 1 ? "" : "s"} not returned`}
                  </p>
                )}
              </div>
              {isAdmin && (
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" aria-label={`Edit ${r.name}`} onClick={() => setDraft({ id: r.id, name: r.name, phone: r.phone, address: r.address, remarks: r.remarks })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="danger" size="sm" aria-label={`Delete ${r.name}`} onClick={() => remove(r)} disabled={pending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              )}
            </div>
            {isAdmin && r.remarks && (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" /> {r.remarks}
              </p>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="glass rounded-2xl p-6 text-center text-navy/60 md:col-span-2">No customers found.</li>}
      </ul>
    </div>
  );
}
