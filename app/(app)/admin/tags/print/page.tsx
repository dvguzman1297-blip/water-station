import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TagSheet } from "@/components/tag-sheet";

export const dynamic = "force-dynamic";

export default async function PrintTagsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("qr_tags").select("tag_code").eq("enabled", true).order("tag_code");
  return <TagSheet tags={(data ?? []).map((t) => t.tag_code)} />;
}
