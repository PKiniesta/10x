import { defineMiddleware } from "astro:middleware";
import { createSupabaseAdminClient } from "../db/supabase.admin.ts";
import { createSupabaseServerInstance } from "../db/supabase.client.ts";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/callback",
  "/api/auth/reset-password",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { locals, cookies, url, request, redirect } = context;

  const supabase = createSupabaseServerInstance({
    cookies,
    headers: request.headers,
  });

  context.locals.supabase = supabase;
  context.locals.supabaseAdmin = createSupabaseAdminClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  locals.user = user;
  locals.session = session;

  const isPublicPath = PUBLIC_PATHS.some((path) => url.pathname.startsWith(path));

  // Guard - protect index and /cards paths for guests
  const isProtectedPath =
    url.pathname === "/" ||
    url.pathname.startsWith("/cards") ||
    url.pathname.startsWith("/api/cards") ||
    url.pathname.startsWith("/api/ai") ||
    url.pathname.startsWith("/ai/");

  if (!user && isProtectedPath && !isPublicPath) {
    return redirect("/login");
  }

  // Redirect logged in users away from auth pages
  if (user && (url.pathname === "/login" || url.pathname === "/register")) {
    return redirect("/cards");
  }

  return next();
});
