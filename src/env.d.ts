/// <reference types="astro/client" />

import type { SupabaseAdminClient } from "./db/supabase.admin.ts";
import type { SupabaseClient } from "./db/supabase.client.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      supabaseAdmin: SupabaseAdminClient;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  /** @deprecated Prefer SUPABASE_ANON_KEY for browser/anon access. */
  readonly SUPABASE_KEY?: string;
  readonly OPENROUTER_API_KEY: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
