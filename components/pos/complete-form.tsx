"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Counter } from "./counter";
import { completeOrder } from "@/app/actions";
import { scanFeedback } from "@/lib/feedback";
import { peso } from "@/lib/utils";

export function CompleteForm({
  orderId,
  orderNumber,
  customer,
  quantity,
  total,
  alreadyPaid,
  onDone,
}: {
  orderId: string;
  orderNumber: number;
  customer: string;
  quantity: number;
  total: number;
  alreadyPaid: boolean;
  onDone: (message: string) => void;
}) {
  const [empties, setEmpties] = useState(quantity);
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await completeOrder(orderId, empties, paid || alreadyPaid);
      if (!res.ok) {
        scanFeedback("error");
        setError(res.error);
        return;
      }
      scanFeedback("ok");
      onDone(`Order #${orderNumber} delivered`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
        <p className="text-sm font-semibold text-sky-900">Order #{orderNumber}</p>
        <p className="text-xl font-bold">{customer}</p>
        <p className="text-navy/70">
          {quantity} {quantity === 1 ? "gallon" : "gallons"} · {peso(total)}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Empties returned</p>
          <p className="text-sm text-navy/60">Out of {quantity} delivered</p>
        </div>
        <Counter value={empties} onChange={setEmpties} label="empties" />
      </div>

      {!alreadyPaid && (
        <button
          type="button"
          role="switch"
          aria-checked={paid}
          onClick={() => setPaid(!paid)}
          className={`flex h-14 w-full items-center justify-between rounded-2xl px-4 text-left font-semibold ring-1 ${
            paid ? "bg-ok-50 text-emerald-900 ring-emerald-300" : "bg-amber-50 text-amber-900 ring-amber-300"
          }`}
        >
          <span>{paid ? `Payment received: ${peso(total)}` : "Customer will pay later"}</span>
          <span className="text-sm font-medium underline">Change</span>
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">
          {error}
        </p>
      )}

      <Button variant="success" size="lg" className="w-full" onClick={submit} loading={pending}>
        {!pending && <CheckCircle2 className="h-6 w-6" />}
        {alreadyPaid || paid ? "Mark paid & delivered" : "Mark delivered, unpaid"}
      </Button>
    </div>
  );
}
