"use client";
import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** Shows an order's QR tag: scan it straight off the screen, or print a label to attach to the order. */
export function TagModal({
  tag,
  orderNumber,
  customer,
  onClose,
}: {
  tag: string;
  orderNumber: number;
  customer?: string;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  function print() {
    const svg = box.current?.querySelector("svg")?.outerHTML;
    const w = window.open("", "_blank", "width=420,height=520");
    if (!svg || !w) return;
    w.document.write(
      `<!doctype html><title>${tag}</title><style>
        body{font-family:system-ui,sans-serif;text-align:center;margin:0;padding:24px}
        svg{width:240px;height:240px}h1{font-size:34px;margin:12px 0 0}p{font-size:18px;margin:4px 0}
      </style>${svg}<h1>${tag}</h1><p>Order #${orderNumber}</p>${customer ? `<p>${customer.replace(/</g, "&lt;")}</p>` : ""}
      <script>window.onload=()=>{window.print();window.close()}</script>`
    );
    w.document.close();
  }

  return (
    <Modal open onClose={onClose} title={`Order #${orderNumber} tag`}>
      <div className="flex flex-col items-center gap-4">
        <div ref={box} className="rounded-2xl bg-white p-4 ring-1 ring-navy/15">
          <QRCodeSVG value={tag} size={220} level="M" marginSize={1} />
        </div>
        <p className="text-2xl font-extrabold tracking-wide">{tag}</p>
        <p className="text-center text-sm text-navy/60">
          Scan this to move the order forward, or print it and attach it to the order.
        </p>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={print}><Printer className="h-5 w-5" /> Print</Button>
          <Button size="lg" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
