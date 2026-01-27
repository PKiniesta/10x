import type { APIContext } from "astro";
import type { ZodIssue } from "zod";

import { acceptAiProposalCommandSchema, acceptAiProposalParamsSchema } from "@/lib/validation/ai-generation.ts";
import { acceptAiProposal } from "@/lib/services/ai-generation.service.ts";
import type { ApiErrorDto } from "@/types.ts";

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

/**
 * POST /api/ai/generations/:generationId/proposals/:proposalIndex/accept
 * Accepts an AI-generated proposal and creates a card.
 */
export async function POST(context: APIContext): Promise<Response> {
  const now = new Date();

  // Auth: placeholder as in other AI endpoints.
  // In a real application, we would retrieve the userId from the session.
  const userId = "00000000-0000-0000-0000-000000000000";

  // 1) Validate URL Parameters
  const paramsParsed = acceptAiProposalParamsSchema.safeParse(context.params);
  if (!paramsParsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid URL parameters.", 400, {
      issues: paramsParsed.error.issues.map((i: ZodIssue) => ({ path: i.path, message: i.message })),
    });
  }
  const { generationId, proposalIndex } = paramsParsed.data;

  // 2) Parse and Validate Body
  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(context.request);
  } catch (err) {
    const isInvalidContentType = err instanceof Error && err.message === "INVALID_CONTENT_TYPE";
    if (isInvalidContentType) {
      return apiError("VALIDATION_ERROR", "Content-Type must be application/json.", 400);
    }
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const bodyParsed = acceptAiProposalCommandSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid request body.", 400, {
      issues: bodyParsed.error.issues.map((i: ZodIssue) => ({ path: i.path, message: i.message })),
    });
  }
  const { front, back, reviewToken } = bodyParsed.data;

  // 3) Call Service
  try {
    const supabaseAdmin = context.locals.supabaseAdmin;

    const result = await acceptAiProposal({
      supabaseAdmin,
      userId,
      generationId,
      proposalIndex,
      front,
      back,
      reviewToken,
      now,
    });

    switch (result.kind) {
      case "success":
        return jsonResponse(result.dto, { status: 201 });
      case "limit-reached":
        return apiError("DAILY_AI_ACCEPT_LIMIT_REACHED", "Daily AI proposal acceptance limit reached.", 429);
      case "generation-not-found":
        return apiError("GENERATION_NOT_FOUND", "AI generation session not found or access denied.", 404);
      case "proposal-already-decided":
        return apiError("PROPOSAL_ALREADY_DECIDED", "This proposal has already been accepted or rejected.", 409);
      default:
        // This will be caught by the catch block if it's an unhandled kind
        return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
    }
  } catch (error) {
    console.error(`[API acceptProposal] Unexpected error:`, error);
    return apiError("INTERNAL_ERROR", "Internal server error.", 500);
  }
}
