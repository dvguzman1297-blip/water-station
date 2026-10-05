import { cn } from "@/lib/utils";
import type { Status, PaymentStatus } from "@/lib/types";

const MAP: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-900 ring-amber-300" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-sky-100 text-sky-900 ring-sky-300" },
  delivered: { label: "Delivered", cls: "bg-ok-50 text-emerald-900 ring-emerald-300" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = MAP[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1", s.cls)}>
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return status === "paid" ? (
    <span className="inline-flex rounded-full bg-ok-50 px-3 py-1 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-300">
      Paid
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-900 ring-1 ring-rose-300">
      Unpaid
    </span>
  );
}
