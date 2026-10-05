"use client";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

export function TagSheet({ tags }: { tags: string[] }) {
  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">QR tag sheet</h1>
        <button
          onClick={() => window.print()}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 font-semibold text-white"
        >
          <Printer className="h-5 w-5" /> Print
        </button>
      </div>
      <div className="tag-sheet grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tags.map((t) => (
          <div key={t} className="tag-cell flex flex-col items-center gap-2 rounded-xl border border-navy/30 bg-white p-3">
            <QRCodeSVG value={t} size={128} level="M" marginSize={1} />
            <p className="text-xl font-extrabold tracking-wide">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
