import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = { id: string; full_name: string; role: "admin" | "staff" };

export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!data) {
    const reason = error ? `${error.message} (${error.code})` : "No profile found for this account.";
    redirect("/login?error=" + encodeURIComponent(reason));
  }
  return data as Profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (profile.role !== "admin") redirect("/");
  return profile;
}
