import type { APIRoute } from "astro";
import { getTodayInlineLimits } from "../../../lib/services/limits.service";
import type { TodayLimitsDto, ApiErrorDto } from "../../../types";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const { user, supabaseAdmin } = locals;

  if (!user) {
    const errorResponse: ApiErrorDto = {
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication required to access limits.",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    const limits = await getTodayInlineLimits({
      supabaseAdmin,
      userId: user.id,
      now,
    });

    const response: TodayLimitsDto = {
      timezone: "UTC",
      resetAt: limits.resetAt.toISOString(),
      generationRequests: limits.generation,
      aiAcceptedCards: limits.aiAccepted,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/limits/today] unexpected error:", error);

    const errorResponse: ApiErrorDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while fetching limits.",
      },
    };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
