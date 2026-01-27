import type { APIContext } from "astro";

import { getCardById, updateCard } from "@/lib/services/card.service";
import { CardIdSchema, UpdateCardSchema } from "@/lib/validation/cards";
import type { ApiErrorDto } from "@/types";

export const prerender = false;

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function apiError(
  code: ApiErrorDto["error"]["code"],
  message: string,
  status: number,
  details?: Record<string, unknown>
): Response {
  const body: ApiErrorDto = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };

  return jsonResponse(body, { status });
}

export async function GET(context: APIContext): Promise<Response> {
  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await context.locals.supabase.auth.getUser();

  if (authError || !user) {
    return apiError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  // 2) Validate path param
  const rawCardId = context.params.cardId;
  const parsedCardId = CardIdSchema.safeParse(rawCardId);

  if (!parsedCardId.success) {
    return apiError("VALIDATION_ERROR", "Invalid cardId.", 400, {
      issues: parsedCardId.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // 3) Logic
  try {
    const card = await getCardById(context.locals.supabase, user.id, parsedCardId.data);

    if (!card) {
      return apiError("CARD_NOT_FOUND", "Card not found.", 404);
    }

    return jsonResponse(card, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/cards/[cardId] failed:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}

export async function PATCH(context: APIContext): Promise<Response> {
  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await context.locals.supabase.auth.getUser();

  if (authError || !user) {
    return apiError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  // 2) Validate path param
  const rawCardId = context.params.cardId;
  const parsedCardId = CardIdSchema.safeParse(rawCardId);

  if (!parsedCardId.success) {
    return apiError("VALIDATION_ERROR", "Invalid cardId.", 400, {
      issues: parsedCardId.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // 3) Parse JSON body
  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  // 4) Validate body
  const parsedBody = UpdateCardSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return apiError("VALIDATION_ERROR", "Request body validation failed.", 400, {
      issues: parsedBody.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // 5) Logic
  try {
    const updated = await updateCard(context.locals.supabase, user.id, parsedCardId.data, parsedBody.data);

    if (!updated) {
      return apiError("CARD_NOT_FOUND", "Card not found.", 404);
    }

    return jsonResponse(updated, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("PATCH /api/cards/[cardId] failed:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
