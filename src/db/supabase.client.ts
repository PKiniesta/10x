import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { getSecret } from "astro:env/server";

import type { Database } from "./database.types.ts";

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

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

function readSupabaseUrl(): string | undefined {
  const raw = getSecret("SUPABASE_URL") ?? import.meta.env.SUPABASE_URL;
  const normalized = normalizeEnvVar(raw);
  if (!normalized && raw) {
    throw new Error("Invalid SUPABASE_URL env var");
  }
  return normalized;
}

function readSupabaseAnonKey(): string | undefined {
  const raw =
    getSecret("SUPABASE_ANON_KEY") ??
    getSecret("SUPABASE_KEY") ??
    import.meta.env.SUPABASE_ANON_KEY ??
    import.meta.env.SUPABASE_KEY;

  const normalized = normalizeEnvVar(raw);
  if (!normalized && raw) {
    throw new Error("Invalid SUPABASE_ANON_KEY env var");
  }
  return normalized;
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

type AstroCookieSetOptions = NonNullable<Parameters<AstroCookies["set"]>[2]>;

function normalizeCookieOptions(options: Record<string, unknown> | undefined): AstroCookieSetOptions | undefined {
  if (!options) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};

  const path = options.path;
  if (typeof path === "string" && path.trim()) {
    normalized.path = path;
  }

  const domain = options.domain;
  if (typeof domain === "string" && domain.trim()) {
    normalized.domain = domain;
  }

  const httpOnly = options.httpOnly;
  if (typeof httpOnly === "boolean") {
    normalized.httpOnly = httpOnly;
  }

  const secure = options.secure;
  if (typeof secure === "boolean") {
    normalized.secure = secure;
  }

  const expires = options.expires;
  if (typeof expires === "string") {
    const d = new Date(expires);
    if (!Number.isNaN(d.getTime())) {
      normalized.expires = d;
    }
  } else if (expires instanceof Date) {
    if (!Number.isNaN(expires.getTime())) {
      normalized.expires = expires;
    }
  }

  const maxAge = options.maxAge;
  if (typeof maxAge === "number") {
    if (Number.isFinite(maxAge)) {
      normalized.maxAge = maxAge;
    }
  } else if (maxAge !== undefined) {
    const n = Number(maxAge);
    if (Number.isFinite(n)) {
      normalized.maxAge = n;
    }
  }

  const sameSite = options.sameSite;
  if (typeof sameSite === "string") {
    const v = sameSite.toLowerCase();
    if (v === "lax" || v === "strict" || v === "none") {
      normalized.sameSite = v;
    }
  }

  if (!Object.keys(normalized).length) {
    return undefined;
  }

  return normalized as AstroCookieSetOptions;
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
