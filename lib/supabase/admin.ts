import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DB_SCHEMA } from "./schema";

/** Service-role client. Only import from server actions that have already verified the caller is an admin. */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: DB_SCHEMA },
  });
}
