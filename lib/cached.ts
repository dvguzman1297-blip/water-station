import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Shared reference data for the order screen. Read with the service key (cookies can't be used
// inside a cache) and only after the page has confirmed the caller is signed in.
// Invalidate with revalidateTag("products") / revalidateTag("customers") when they change.

export const getPublicProducts = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient()
      .from("products")
      .select("code, name, price")
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["products-public"],
  { revalidate: 300, tags: ["products"] }
);

export const getCustomerList = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient()
      .from("customers")
      .select("id, name")
      .order("name")
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["customers-list"],
  { revalidate: 300, tags: ["customers"] }
);
