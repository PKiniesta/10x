import type { APIRoute } from "astro";
import { resetPasswordSchema } from "@/lib/validation/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({ error: "Nieprawidłowe dane" }), {
        status: 400,
      });
    }

    const { password } = result.data;
    const { error } = await locals.supabase.auth.updateUser({
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
  } catch (err) {
    console.error("Update password error:", err);
    return new Response(JSON.stringify({ error: "Wystąpił nieoczekiwany błąd" }), {
      status: 500,
    });
  }
};
