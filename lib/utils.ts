import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function peso(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return "₱" + v.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Pull "ORD-0042" out of whatever the QR contains (plain text or a URL). */
export function normalizeTag(raw: string) {
  const m = raw.match(/TAG-\d+/i);
  return (m ? m[0] : raw).trim().toUpperCase();
}
