import type { APIRoute } from "astro";
import { loginSchema } from "@/lib/validation/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Nieprawidłowe dane logowania", details: result.error.format() }), {
        status: 400,
      });
    }

    const { email, password } = result.data;
    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status || 400,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Login error:", err.message);
    }
    return new Response(JSON.stringify({ error: "Wystąpił nieoczekiwany błąd" }), {
      status: 500,
    });
  }
};
