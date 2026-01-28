import type { APIRoute } from "astro";
import { registerSchema } from "@/lib/validation/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Nieprawidłowe dane rejestracji", details: result.error.format() }), {
        status: 400,
      });
    }

    const { email, password } = result.data;
    const origin = url.origin;
    const redirectTo = `${origin}/api/auth/callback`;

    const { error } = await locals.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status || 400,
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Sprawdź skrzynkę e-mail, aby aktywować konto." }), {
      status: 200,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Registration error:", err.message);
    }
    return new Response(JSON.stringify({ error: "Wystąpił nieoczekiwany błąd" }), {
      status: 500,
    });
  }
};
