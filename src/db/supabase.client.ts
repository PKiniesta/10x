import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { getSecret } from "astro:env/server";

import type { Database } from "./database.types.ts";

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

function readSupabaseUrl(): string | undefined {
  return getSecret("SUPABASE_URL") ?? import.meta.env.SUPABASE_URL;
}

function readSupabaseAnonKey(): string | undefined {
  return (
    getSecret("SUPABASE_ANON_KEY") ??
    getSecret("SUPABASE_KEY") ??
    import.meta.env.SUPABASE_ANON_KEY ??
    import.meta.env.SUPABASE_KEY
  );
}

let cachedSupabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL env var");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing SUPABASE_ANON_KEY env var");
  }

  cachedSupabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return cachedSupabaseClient;
}

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }) => {
  const supabaseUrl = readSupabaseUrl();
  const supabaseAnonKey = readSupabaseAnonKey();

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL env var");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing SUPABASE_ANON_KEY env var");
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey!, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
      },
    },
  });
};
