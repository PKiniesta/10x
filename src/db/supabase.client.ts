import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
// This client is intended for anon/public usage.
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL env var");
}

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY env var");
}

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
