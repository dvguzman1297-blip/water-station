"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, Receipt, Settings, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const STAFF = [{ href: "/", label: "Orders", icon: ClipboardList }];
const ADMIN = [
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/margins", label: "Margins", icon: TrendingUp },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/inventory", label: "Stock", icon: Boxes },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...STAFF, ...ADMIN] : STAFF;
  if (!isAdmin) return null;
  return (
    <nav
      aria-label="Main"
      className="no-print glass fixed inset-x-0 bottom-0 z-30 flex justify-around border-x-0 border-b-0 px-1 pb-[env(safe-area-inset-bottom)] lg:static lg:mx-auto lg:mb-4 lg:max-w-5xl lg:gap-2 lg:rounded-2xl lg:border lg:p-2"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-semibold lg:flex-row lg:gap-2 lg:px-4 lg:text-sm",
              active ? "bg-navy text-white" : "text-navy/70 hover:bg-navy/5"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
