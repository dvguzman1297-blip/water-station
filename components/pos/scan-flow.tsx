"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CompleteForm } from "./complete-form";
import { scanTag } from "@/app/actions";
import { scanFeedback } from "@/lib/feedback";
import { normalizeTag } from "@/lib/utils";
import type { ScanInfo } from "@/lib/types";

type Phase =
  | { kind: "scan" }
  | { kind: "message"; text: string }
  | { kind: "confirm"; info: ScanInfo };

/** Scan an order tag: pending -> out for delivery; out for delivery -> confirm delivery. */
export function ScanFlow({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "scan" });
  const [error, setError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);

  async function handleCode(raw: string) {
    const code = normalizeTag(raw);
    if (!code || busy.current) return;
    const now = Date.now();
    if (lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 2500) return;
    lastCode.current = { code, at: now };
    busy.current = true;
    setError(null);
    try {
      const res = await scanTag(code);
      if (!res.ok) {
        scanFeedback("error");
        setError(res.error);
        return;
      }
      const info = res.data;
      if (info.action === "unknown" || info.action === "free") {
        scanFeedback("error");
        setError(`${info.tag} is not an order tag.`);
      } else if (info.action === "closed") {
        scanFeedback("error");
        setError(`${info.tag} is already ${info.status === "cancelled" ? "cancelled" : "delivered"}.`);
      } else if (info.action === "dispatched") {
        scanFeedback("ok");
        setPhase({ kind: "message", text: `Order #${info.order_number} for ${info.customer} is out for delivery` });
      } else {
        scanFeedback("ok");
        setPhase({ kind: "confirm", info });
      }
    } finally {
      busy.current = false;
    }
  }

  const handler = useRef(handleCode);
  handler.current = handleCode;

  // Camera lifecycle: runs only while we are in the scanning phase.
  useEffect(() => {
    if (phase.kind !== "scan") return;
    let stopped = false;
    let scanner: any;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        scanner = new Html5Qrcode("qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (text: string) => handler.current(text),
          () => {}
        );
      } catch {
        setCamError("Camera is not available. Type the tag number below instead.");
      }
    })();
    return () => {
      stopped = true;
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [phase.kind]);

  // Close automatically a moment after a success message.
  useEffect(() => {
    if (phase.kind !== "message") return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  const title = phase.kind === "confirm" ? "Confirm delivery" : "Scan order tag";

  return (
    <Modal open onClose={onClose} title={title}>
      {phase.kind === "scan" && (
        <div className="space-y-4">
          <div id="qr-reader" className="overflow-hidden rounded-2xl bg-navy/90 [&_video]:w-full" style={{ minHeight: 260 }} />
          {camError && <p className="text-sm text-navy/70">{camError}</p>}
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                const v = /^\d+$/.test(manual.trim()) ? `ORD-${manual.trim().padStart(4, "0")}` : manual;
                handleCode(v);
                setManual("");
              }
            }}
            className="flex gap-2"
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Order number, e.g. 42"
              inputMode="numeric"
              aria-label="Order number"
              className="field"
            />
            <Button type="submit" variant="outline">Go</Button>
          </form>
        </div>
      )}

      {phase.kind === "message" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-ok" />
          <p className="text-xl font-bold">{phase.text}</p>
        </div>
      )}

      {phase.kind === "confirm" && phase.info.order_id && (
        <CompleteForm
          orderId={phase.info.order_id}
          orderNumber={phase.info.order_number ?? 0}
          customer={phase.info.customer ?? "Walk-in"}
          quantity={phase.info.quantity ?? 0}
          total={phase.info.total ?? 0}
          alreadyPaid={phase.info.payment_status === "paid"}
          onDone={(text) => setPhase({ kind: "message", text })}
        />
      )}
    </Modal>
  );
}
