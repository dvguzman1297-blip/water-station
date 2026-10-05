"use client";
import { motion } from "framer-motion";
import { MapPin, Phone, QrCode, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentBadge, StatusBadge } from "@/components/ui/status-badge";
import { peso } from "@/lib/utils";
import type { OrderRow } from "@/lib/types";

export function OrderCard({
  order,
  names,
  onLinkTag,
  onDispatch,
  onDeliver,
  onMarkPaid,
  onCancel,
  busy,
}: {
  order: OrderRow;
  names: Record<string, string>;
  onLinkTag: () => void;
  onDispatch: () => void;
  onDeliver: () => void;
  onMarkPaid: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const summary = order.order_items.map((i) => `${i.quantity} × ${names[i.container_type] ?? i.container_type}`).join(", ");
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy/60">Order #{order.order_number}</p>
          <p className="truncate text-xl font-bold">{order.customers?.name ?? "Walk-in"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.payment_status} />
        </div>
      </div>

      <p className="mt-2 text-lg">{summary}</p>
      <p className="text-lg font-bold">{peso(order.total_amount)}</p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/70">
        {order.qr_tag_id && order.status !== "delivered" && (
          <span className="flex items-center gap-1 font-semibold"><Tag className="h-4 w-4" /> {order.qr_tag_id}</span>
        )}
        {order.customers?.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {order.customers.address}</span>}
        {order.customers?.phone && (
          <a href={`tel:${order.customers.phone}`} className="flex items-center gap-1 underline"><Phone className="h-4 w-4" /> {order.customers.phone}</a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === "pending" && (
          <>
            {order.qr_tag_id ? (
              <Button variant="primary" className="flex-1" onClick={onDispatch} disabled={busy}>Send out for delivery</Button>
            ) : (
              <Button variant="primary" className="flex-1" onClick={onLinkTag}><QrCode className="h-5 w-5" /> Link a tag</Button>
            )}
            <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          </>
        )}
        {order.status === "out_for_delivery" && (
          <>
            <Button variant="success" className="flex-1" onClick={onDeliver}>Delivered</Button>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          </>
        )}
        {order.status === "delivered" && order.payment_status === "unpaid" && (
          <Button variant="success" className="flex-1" onClick={onMarkPaid} disabled={busy}>Payment received</Button>
        )}
      </div>
    </motion.li>
  );
}
