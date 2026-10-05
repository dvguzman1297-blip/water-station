import { Droplets } from "lucide-react";
import { signIn } from "@/app/actions";
import { Button } from "@/components/ui/button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <form action={signIn} className="glass w-full max-w-sm rounded-3xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-navy text-white">
            <Droplets className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Water Station</h1>
            <p className="text-navy/60">Sign in to start taking orders</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 font-medium text-rose-900 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="field mb-4" />
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field mb-6" />
        <Button type="submit" size="lg" className="w-full">Sign in</Button>
      </form>
    </main>
  );
}
