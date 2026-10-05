"use client";
import { useMemo, useState, useTransition } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Counter } from "./counter";
import { createCustomer, createOrder } from "@/app/actions";
import { cn, peso } from "@/lib/utils";
import type { Customer, PublicProduct } from "@/lib/types";

export function NewOrder({
  customers,
  products,
  onClose,
  onCreated,
}: {
  customers: Customer[];
  products: PublicProduct[];
  onClose: () => void;
  onCreated: (tag: string, orderNumber: number, customer?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  const all = useMemo(() => [...localCustomers, ...customers], [localCustomers, customers]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? all.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)) : all;
    return list.slice(0, 6);
  }, [all, query]);

  const total = products.reduce((s, p) => s + p.price * (qty[p.code] ?? 0), 0);
  const count = products.reduce((s, p) => s + (qty[p.code] ?? 0), 0);
  const chosen = all.find((c) => c.id === customerId);

  function saveCustomer() {
    setError(null);
    start(async () => {
      const res = await createCustomer({ name: newName, phone: newPhone, address: newAddress });
      if (!res.ok) return setError(res.error);
      setLocalCustomers((l) => [
        { id: res.data.id, name: newName.trim(), phone: newPhone || null, address: newAddress || null },
        ...l,
      ]);
      setCustomerId(res.data.id);
      setAdding(false);
      setNewName("");
      setNewPhone("");
      setNewAddress("");
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await createOrder({
        customerId,
        items: products.map((p) => ({ code: p.code, qty: qty[p.code] ?? 0 })),
        paid,
      });
      if (!res.ok) return setError(res.error);
      onCreated(res.data.tag, res.data.orderNumber, chosen?.name);
    });
  }

  return (
    <Modal open onClose={onClose} title="New order">
      <div className="space-y-5">
        <section aria-label="Customer">
          <p className="label">Customer</p>
          {chosen && !adding ? (
            <div className="flex items-center justify-between rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-200">
              <div>
                <p className="text-lg font-bold">{chosen.name}</p>
                {chosen.address && <p className="text-sm text-navy/60">{chosen.address}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCustomerId(null)}>Change</Button>
            </div>
          ) : adding ? (
            <div className="space-y-2 rounded-2xl bg-white/70 p-3 ring-1 ring-navy/10">
              <input className="field" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Customer name" />
              <input className="field" placeholder="Phone (optional)" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} aria-label="Phone" />
              <input className="field" placeholder="Address (optional)" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} aria-label="Address" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveCustomer} disabled={pending || !newName.trim()}>Save customer</Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-navy/40" />
                <input className="field pl-10" placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCustomerId(c.id)}
                    className="min-h-14 rounded-xl bg-white px-3 py-2 text-left font-semibold shadow-sm ring-1 ring-navy/10 active:scale-[.98]"
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  onClick={() => { setAdding(true); setNewName(query); }}
                  className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-dashed border-ocean/50 px-3 font-semibold text-ocean"
                >
                  <UserPlus className="h-5 w-5" /> New customer
                </button>
              </div>
              <button className="mt-2 text-sm font-medium text-navy/60 underline" onClick={() => setCustomerId(null)}>
                Skip: walk-in with no name
              </button>
            </>
          )}
        </section>

        <section aria-label="Gallons" className="space-y-3">
          {products.map((p) => (
            <div key={p.code} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{p.name}</p>
                <p className="text-sm text-navy/60">{peso(p.price)} each</p>
              </div>
              <Counter label={p.name} value={qty[p.code] ?? 0} onChange={(n) => setQty({ ...qty, [p.code]: n })} />
            </div>
          ))}
        </section>

        <section className="grid gap-2">
          <button
            role="switch"
            aria-checked={paid}
            onClick={() => setPaid(!paid)}
            className={cn("flex min-h-14 items-center gap-2 rounded-xl px-3 font-semibold ring-1", paid ? "bg-ok-50 text-emerald-900 ring-emerald-300" : "bg-white ring-navy/15")}
          >
            {paid && <Check className="h-5 w-5" />} Already paid
          </button>
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">{error}</p>
        )}

        <Button size="lg" className="w-full" onClick={submit} disabled={pending || count === 0}>
          Save order · {count} {count === 1 ? "gallon" : "gallons"} · {peso(total)}
        </Button>
      </div>
    </Modal>
  );
}
