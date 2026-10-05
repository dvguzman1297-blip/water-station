"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { OrderCard } from "./order-card";
import { NewOrder } from "./new-order";
import { ScanFlow } from "./scan-flow";
import { CompleteForm } from "./complete-form";
import { cancelOrder, markPaid, scanTag } from "@/app/actions";
import { scanFeedback } from "@/lib/feedback";
import type { Customer, OrderRow, PublicProduct, Status } from "@/lib/types";

const TABS: { key: "pending" | "out_for_delivery" | "delivered"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

type Overlay =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "scan"; presetOrderId?: string }
  | { kind: "deliver"; orderId: string };

export function OrderBoard({
  orders,
  products,
  customers,
  loadError,
}: {
  orders: OrderRow[];
  products: PublicProduct[];
  customers: Customer[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Status>("pending");
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Keep the board fresh when several people use it. Pause while a dialog is open.
  useEffect(() => {
    if (overlay.kind !== "none") return;
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router, overlay.kind]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const names = useMemo(() => Object.fromEntries(products.map((p) => [p.code, p.name])), [products]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, out_for_delivery: 0, delivered: 0 };
    orders.forEach((o) => {
      if (o.status in c) c[o.status]++;
    });
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const list = orders.filter((o) => o.status === tab);
    if (tab === "delivered") {
      // unpaid first so nobody forgets to collect
      return [...list].sort((a, b) => Number(b.payment_status === "unpaid") - Number(a.payment_status === "unpaid"));
    }
    return tab === "pending" ? [...list].reverse() : list;
  }, [orders, tab]);

  const close = useCallback(() => {
    setOverlay({ kind: "none" });
    router.refresh();
  }, [router]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        scanFeedback("error");
        setToast(res.error ?? "Something went wrong");
        return;
      }
      scanFeedback("ok");
      setToast(okMsg);
      router.refresh();
    });
  }

  const deliverOrder = overlay.kind === "deliver" ? orders.find((o) => o.id === overlay.orderId) : undefined;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => setOverlay({ kind: "new" })}>
          <Plus className="h-6 w-6" /> New order
        </Button>
        <Button size="lg" variant="outline" onClick={() => setOverlay({ kind: "scan" })}>
          <ScanLine className="h-6 w-6" /> Scan tag
        </Button>
      </div>

      <div role="tablist" aria-label="Order status" className="glass mb-4 grid grid-cols-3 gap-1 rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-14 rounded-xl px-1 text-sm font-semibold sm:text-base",
              tab === t.key ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
            )}
          >
            {t.label}
            <span className={cn("ml-1.5 rounded-full px-2 py-0.5 text-xs", tab === t.key ? "bg-white/20" : "bg-navy/10")}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {loadError && (
        <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">
          Could not load orders: {loadError}
        </p>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              names={names}
              busy={pending}
              onLinkTag={() => setOverlay({ kind: "scan", presetOrderId: o.id })}
              onDispatch={() =>
                run(async () => {
                  const r = await scanTag(o.qr_tag_id!);
                  if (r.ok && r.data.action !== "dispatched") return { ok: false, error: "That tag is no longer linked to this order." };
                  return r;
                }, `Order #${o.order_number} is out for delivery`)
              }
              onDeliver={() => setOverlay({ kind: "deliver", orderId: o.id })}
              onMarkPaid={() => run(() => markPaid(o.id), `Order #${o.order_number} marked paid`)}
              onCancel={() => {
                if (confirm(`Cancel order #${o.order_number}?`)) run(() => cancelOrder(o.id), `Order #${o.order_number} cancelled`);
              }}
            />
          ))}
        </AnimatePresence>
      </ul>

      {visible.length === 0 && (
        <p className="glass rounded-2xl p-8 text-center text-lg text-navy/60">
          {tab === "pending" ? "No pending orders. Tap New order to add one." : tab === "out_for_delivery" ? "Nothing is out for delivery." : "No recent deliveries."}
        </p>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl bg-navy px-4 py-3 text-center font-semibold text-white shadow-xl lg:bottom-6">
          {toast}
        </div>
      )}

      {overlay.kind === "new" && (
        <NewOrder
          customers={customers}
          products={products}
          onClose={close}
          onCreated={(id, linkTag) => {
            router.refresh();
            setOverlay(linkTag ? { kind: "scan", presetOrderId: id } : { kind: "none" });
            if (!linkTag) setToast("Order saved");
          }}
        />
      )}
      {overlay.kind === "scan" && <ScanFlow orders={orders} presetOrderId={overlay.presetOrderId} onClose={close} />}
      {overlay.kind === "deliver" && deliverOrder && (
        <Modal open onClose={close} title="Confirm delivery">
          <CompleteForm
            orderId={deliverOrder.id}
            orderNumber={deliverOrder.order_number}
            customer={deliverOrder.customers?.name ?? "Walk-in"}
            quantity={deliverOrder.order_items.reduce((s, i) => s + i.quantity, 0)}
            total={deliverOrder.total_amount}
            alreadyPaid={deliverOrder.payment_status === "paid"}
            onDone={(msg) => {
              setToast(msg);
              close();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
