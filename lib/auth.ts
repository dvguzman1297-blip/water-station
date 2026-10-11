import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Profile = { id: string; full_name: string; role: "admin" | "staff" };

// Profile rows change rarely; keep them for a minute and drop them when accounts are edited
// (revalidateTag("profiles")). Server actions still check the role against the database.
const loadProfile = unstable_cache(
  async (id: string) => {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", id)
      .single();
    if (!data) throw new Error(error ? `${error.message} (${error.code})` : "No profile found for this account.");
    return data as Profile;
  },
  ["profile"],
  { revalidate: 60, tags: ["profiles"] }
);

// Memoized per request, so the layout and the page share one lookup.
export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  // Verifies the JWT locally when the project uses asymmetric keys (no network round trip);
  // middleware has already validated the session with Supabase for this request.
  const { data: auth } = await supabase.auth.getClaims();
  const id = auth?.claims?.sub;
  if (!id) redirect("/login");
  try {
    return await loadProfile(id);
  } catch (e) {
    redirect("/login?error=" + encodeURIComponent(e instanceof Error ? e.message : "No profile found for this account."));
  }
});


// Account controls: admin (manager) only.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
