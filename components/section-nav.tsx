import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionTab = { id: string; label: string; icon: LucideIcon };

/** Sidebar on desktop, scrollable pill strip on mobile. Tabs are links (`?tab=id`), so the page stays server-rendered. */
export function SectionNav({ base, tabs, current, label }: { base: string; tabs: readonly SectionTab[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {tabs.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={`${base}?tab=${id}`}
          aria-current={current === id ? "page" : undefined}
          className={cn(
            "flex min-h-12 shrink-0 items-center gap-3 rounded-full px-4 text-sm font-semibold",
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
