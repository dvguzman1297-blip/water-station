import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionTab = { id: string; label: string; icon: LucideIcon };

/** Sidebar on desktop; on mobile the tabs share the row equally (icon above label) so nothing overflows. Tabs are links (`?tab=id`), so the page stays server-rendered. */
export function SectionNav({ base, tabs, current, label }: { base: string; tabs: readonly SectionTab[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 lg:flex lg:flex-col lg:gap-2">
      {tabs.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={`${base}?tab=${id}`}
          aria-current={current === id ? "page" : undefined}
          className={cn(
            "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center text-xs font-semibold leading-tight lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-full lg:px-4 lg:text-sm",
            current === id ? "bg-ocean/15 text-navy" : "text-navy/70 hover:bg-navy/5"
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
