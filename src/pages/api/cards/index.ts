import type { APIContext } from "astro";

import { createManualCard } from "@/lib/services/card.service";
import { CreateManualCardSchema } from "@/lib/validation/cards";
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

async function readJsonBody(request: Request): Promise<unknown> {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    throw new Error("INVALID_CONTENT_TYPE");
  }

  return request.json();
}

export async function POST(context: APIContext): Promise<Response> {
  // 1) Auth - check user session
  // NOTE: Based on the implementation plan, we rely on Supabase auth.
  const {
    data: { user },
    error: authError,
  } = await context.locals.supabase.auth.getUser();

  if (authError || !user) {
    return apiError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  // 2) Parse JSON
  let raw: unknown;
  try {
    raw = await readJsonBody(context.request);
  } catch (err) {
    const isInvalidContentType = err instanceof Error && err.message === "INVALID_CONTENT_TYPE";
    if (isInvalidContentType) {
      return apiError("VALIDATION_ERROR", "Content-Type must be application/json.", 400);
    }

    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  // 3) Validate
  const parsed = CreateManualCardSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid request body.", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  // 4) Logic
  try {
    const cardDto = await createManualCard(context.locals.supabase, user.id, parsed.data);

    return jsonResponse(cardDto, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/cards failed:", err);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
