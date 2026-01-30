import { createClient } from "@supabase/supabase-js";
import { getSecret } from "astro:env/server";

import type { Database } from "./database.types";

/**
 * Server-only Supabase client.
 *
 * IMPORTANT:
 * - This client must use the Service Role key to bypass RLS for server-side writes.
 * - Do not fall back to anon/public keys here; that can silently break endpoints.
 */
export type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

export function createSupabaseAdminClient(): SupabaseAdminClient {
  const supabaseUrl = getSecret("SUPABASE_URL") ?? import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey = getSecret("SUPABASE_SERVICE_ROLE_KEY") ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL env var");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
