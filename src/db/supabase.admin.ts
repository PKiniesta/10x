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

function normalizeEnvVar(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  if (!unquoted) {
    return undefined;
  }

  if (/\s/.test(unquoted)) {
    return undefined;
  }

  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(unquoted)) {
    return undefined;
  }

  return unquoted;
}

export function createSupabaseAdminClient(): SupabaseAdminClient {
  const supabaseUrl = normalizeEnvVar(getSecret("SUPABASE_URL") ?? import.meta.env.SUPABASE_URL);
  const supabaseServiceRoleKey = normalizeEnvVar(
    getSecret("SUPABASE_SERVICE_ROLE_KEY") ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  );

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
