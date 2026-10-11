"use client";
import { useMemo, useState, useTransition } from "react";
import { Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Counter } from "./counter";
import { updateOrder } from "@/app/actions";
import { cn, peso } from "@/lib/utils";
import type { Customer, OrderRow, PublicProduct } from "@/lib/types";

/** Change the customer and gallons on an order that has not been delivered yet. */
export function EditOrder({
  order,
  customers,
  products,
  names,
  onClose,
  onSaved,
}: {
  order: OrderRow;
  customers: Customer[];
  products: PublicProduct[];
  names: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState(order.customer_id ?? "");
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(order.order_items.map((i) => [i.container_type, i.quantity]))
  );
  const [paid, setPaid] = useState(order.payment_status === "paid");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Gallon types hidden since the order was placed stay editable so their lines are not lost.
  const rows = useMemo(() => {
    const known = new Set(products.map((p) => p.code));
    const extra = order.order_items
      .filter((i) => !known.has(i.container_type))
      .map((i) => ({ code: i.container_type, name: names[i.container_type] ?? i.container_type, price: null as number | null }));
    return [...products.map((p) => ({ code: p.code, name: p.name, price: p.price as number | null })), ...extra];
  }, [products, order.order_items, names]);

  const count = rows.reduce((s, r) => s + (qty[r.code] ?? 0), 0);
  const list = useMemo(() => {
    const hasCurrent = customers.some((c) => c.id === order.customer_id);
    return hasCurrent || !order.customers ? customers : [{ id: order.customer_id ?? "", name: order.customers.name }, ...customers];
  }, [customers, order]);

  function save() {
    setError(null);
    start(async () => {
      const res = await updateOrder({
        orderId: order.id,
        customerId: customerId || null,
        items: rows.map((r) => ({ code: r.code, qty: qty[r.code] ?? 0 })),
        paid,
      });
      if (!res.ok) return setError(res.error);
      onSaved();
    });
  }

  return (
    <Modal open onClose={onClose} title={`Edit order #${order.order_number}`}>
      <div className="space-y-5">
        <section>
          <label className="label" htmlFor="edit-customer">Customer</label>
          <select id="edit-customer" className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in (no name)</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </section>

        <section aria-label="Gallons" className="space-y-3">
          {rows.map((r) => (
            <div key={r.code} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{r.name}</p>
                {r.price != null && <p className="text-sm text-navy/60">{peso(r.price)} each</p>}
              </div>
              <Counter label={r.name} value={qty[r.code] ?? 0} onChange={(n) => setQty({ ...qty, [r.code]: n })} />
            </div>
          ))}
          <p className="text-sm text-navy/60">Lines already on the order keep their original price. The total is recalculated when you save.</p>
        </section>

        <section aria-label="Payment">
          <p className="label">Payment</p>
          <div role="radiogroup" aria-label="Payment" className="grid grid-cols-2 gap-2">
            {[
              { value: false, title: "Unpaid", hint: "Collect when delivered", icon: Banknote },
              { value: true, title: "Paid", hint: "Customer already paid", icon: Check },
            ].map(({ value, title, hint, icon: Icon }) => (
              <button
                key={title}
                type="button"
                role="radio"
                aria-checked={paid === value}
                onClick={() => setPaid(value)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl px-3 text-left ring-1 transition",
                  paid === value
                    ? value ? "bg-ok-50 text-emerald-900 ring-2 ring-emerald-500" : "bg-sky-50 text-navy ring-2 ring-ocean"
                    : "bg-white text-navy/70 ring-navy/15 hover:bg-white/80"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-xs font-medium opacity-80">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">{error}</p>
        )}

        <Button size="lg" className="w-full" onClick={save} loading={pending} disabled={count === 0}>
          Save changes
        </Button>
      </div>
    </Modal>
  );
}
