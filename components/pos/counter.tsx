"use client";
import { Minus, Plus } from "lucide-react";

export function Counter({
  value,
  onChange,
  min = 0,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-navy shadow ring-1 ring-navy/10 active:scale-95 disabled:opacity-40"
        disabled={value <= min}
      >
        <Minus className="h-6 w-6" />
      </button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => onChange(value + 1)}
        className="grid h-14 w-14 place-items-center rounded-2xl bg-ocean text-white shadow active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
