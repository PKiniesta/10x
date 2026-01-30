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

function normalizeCookieOptions(options: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!options) {
    return options;
  }

  const normalized: Record<string, unknown> = { ...options };

  const expires = normalized.expires;
  if (typeof expires === "string") {
    const d = new Date(expires);
    if (Number.isNaN(d.getTime())) {
      delete normalized.expires;
    } else {
      normalized.expires = d;
    }
  }

  const maxAge = normalized.maxAge;
  if (maxAge !== undefined && typeof maxAge !== "number") {
    const n = Number(maxAge);
    if (Number.isFinite(n)) {
      normalized.maxAge = n;
    } else {
      delete normalized.maxAge;
    }
  }

  const sameSite = normalized.sameSite;
  if (typeof sameSite === "string") {
    const v = sameSite.toLowerCase();
    if (v === "lax" || v === "strict" || v === "none") {
      normalized.sameSite = v;
    } else {
      delete normalized.sameSite;
    }
  }

  if (normalized.path === "") {
    delete normalized.path;
  }

  if (normalized.domain === "") {
    delete normalized.domain;
  }

  return normalized;
}

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader.trim()) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      return { name, value: rest.join("=") };
    })
    .filter(({ name }) => Boolean(name));
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
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            context.cookies.set(name, value, normalizeCookieOptions(options));
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("Failed to set Supabase auth cookie", {
              name,
              valueLength: value.length,
              options,
              normalizedOptions: normalizeCookieOptions(options),
              error: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
        });
      },
    },
  });
};
