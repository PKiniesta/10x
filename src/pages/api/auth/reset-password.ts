import type { APIRoute } from "astro";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
  try {
    const body = await request.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy adres email" }), {
        status: 400,
      });
    }

    const { email } = result.data;
    const origin = url.origin;
    const redirectTo = `${origin}/api/auth/callback?next=/reset-password`;

    const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status || 400,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(JSON.stringify({ error: "Wystąpił nieoczekiwany błąd" }), {
      status: 500,
    });
  }
};
