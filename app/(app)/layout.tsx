import { LogOut } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const isAdmin = profile.role === "admin";
  return (
    <div className="min-h-dvh pb-24 lg:pb-8">
      <header className="no-print sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-bold">Albekein Water Station</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-white/70 sm:block">
              {profile.full_name} · {isAdmin ? "Admin" : "Staff"}
            </span>
            <form action={signOut}>
              <button
                className="flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <AppNav isAdmin={isAdmin} />
        {children}
      </div>
    </div>
  );
}
