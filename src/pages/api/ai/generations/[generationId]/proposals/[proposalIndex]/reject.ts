import type { APIContext } from "astro";
import type { ZodIssue } from "zod";

import { rejectAiProposalCommandSchema, rejectAiProposalParamsSchema } from "@/lib/validation/ai-generation.ts";
import { rejectAiProposal } from "@/lib/services/ai-generation.service.ts";
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
 * POST /api/ai/generations/:generationId/proposals/:proposalIndex/reject
 * Rejects an AI-generated proposal.
 */
export async function POST(context: APIContext): Promise<Response> {
  // Auth: placeholder as in other AI endpoints.
  const userId = "00000000-0000-0000-0000-000000000000";

  // 1) Validate URL Parameters
  const paramsParsed = rejectAiProposalParamsSchema.safeParse(context.params);
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

  const bodyParsed = rejectAiProposalCommandSchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid request body.", 400, {
      issues: bodyParsed.error.issues.map((i: ZodIssue) => ({ path: i.path, message: i.message })),
    });
  }
  const { reviewToken } = bodyParsed.data;

  // 3) Call Service
  try {
    const supabaseAdmin = context.locals.supabaseAdmin;

    const result = await rejectAiProposal({
      supabaseAdmin,
      userId,
      generationId,
      proposalIndex,
      reviewToken,
    });

    if (result.kind === "generation-not-found") {
      return apiError("GENERATION_NOT_FOUND", "Generation session not found or access denied.", 404);
    }

    if (result.kind === "proposal-already-decided") {
      return apiError("PROPOSAL_ALREADY_DECIDED", "A decision for this proposal has already been made.", 409);
    }

    // result.kind === "success"
    return jsonResponse(result.dto, { status: 200 });
  } catch (error) {
    console.error("[rejectAiProposal] Unexpected error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }
}
