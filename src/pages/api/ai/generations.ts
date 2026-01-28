import type { APIContext } from "astro";

import type { ApiErrorDto, StartAiGenerationResponseDto } from "../../../types";
import { startAiGenerationCommandSchema } from "../../../lib/validation/ai-generation";
import { startAiGeneration } from "../../../lib/services/ai-generation.service";

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
  const { user, supabaseAdmin } = context.locals;

  if (!user) {
    return apiError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  const userId = user.id;
  const now = new Date();

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
  const parsed = startAiGenerationCommandSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid request body.", 400, {
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }

  const { inputText, requestedCardsCount } = parsed.data;

  // 4) Call service
  try {
    const supabaseAdmin = context.locals.supabaseAdmin;

    const res = await startAiGeneration({
      supabaseAdmin,
      userId,
      inputText,
      requestedCardsCount,
      now,
    });

    if (res.kind === "limit-reached") {
      return apiError("DAILY_GENERATION_LIMIT_REACHED", "Daily generation limit reached.", 429);
    }

    const dto: StartAiGenerationResponseDto = res.dto;

    if (dto.ok) {
      return jsonResponse(dto, { status: 201 });
    }

    return jsonResponse(dto, { status: 502 });
  } catch (err) {
    console.error("POST /api/ai/generations failed", err);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
