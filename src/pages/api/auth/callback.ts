import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/cards";

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirect(next);
    }
  }

  return redirect("/login?error=Wystąpił błąd podczas autoryzacji");
};
