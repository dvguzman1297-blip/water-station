import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Size and shape come from className. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}
