import type { SupabaseAdminClient } from "../../db/supabase.admin";
import type {
  AiInlineLimitsDto,
  StartAiGenerationFailureDto,
  StartAiGenerationResponseDto,
  StartAiGenerationSuccessDto,
} from "../../types";
import { getTodayInlineLimits } from "./limits.service";
import { generateProposalsWithOpenRouter } from "./openrouter.client";
import { signReviewToken } from "./review-token.service";

function toIso(date: Date): string {
  return date.toISOString();
}

function toInlineLimitsDto(limits: { generationRemaining: number; acceptedRemaining: number; resetAt: Date }): AiInlineLimitsDto {
  return {
    generationRequestsRemaining: limits.generationRemaining,
    aiAcceptedCardsRemaining: limits.acceptedRemaining,
    resetAt: toIso(limits.resetAt),
  };
}

function safeProviderErrorMessage(code: string): string {
  // Must not include user-provided input.
  if (code === "OPENROUTER_TIMEOUT") return "Generation timed out. Please try again.";
  if (code === "OPENROUTER_UPSTREAM_ERROR") return "Generation failed. Please try again.";
  if (code === "OPENROUTER_BAD_RESPONSE") return "Generation failed. Please try again.";
  return "Generation failed. Please try again.";
}

type StartAiGenerationServiceResult =
  | { kind: "success"; dto: StartAiGenerationSuccessDto }
  | { kind: "upstream-failure"; dto: StartAiGenerationFailureDto }
  | { kind: "limit-reached" };

export async function startAiGeneration(args: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  inputText: string;
  requestedCardsCount: number;
  now: Date;
}): Promise<StartAiGenerationServiceResult> {
  const { supabaseAdmin, userId, inputText, requestedCardsCount, now } = args;

  const limits = await getTodayInlineLimits({ supabaseAdmin, userId, now });
  if (limits.generation.remaining <= 0) {
    return { kind: "limit-reached" };
  }

  // Log request before calling upstream.
  const insertRes = await supabaseAdmin
    .from("ai_generation_requests")
    .insert({
      user_id: userId,
      input_length: inputText.length,
      requested_cards_count: requestedCardsCount,
      status: "failure",
      provider: "openrouter",
      error_code: "IN_PROGRESS",
      error_message: null,
    })
    .select("generation_id")
    .single();

  if (insertRes.error) {
    throw new Error(`Failed to create generation log: ${insertRes.error.message}`);
  }

  const generationId = insertRes.data.generation_id;

  let provider: string | undefined;
  let model: string | undefined;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 60_000);

    const upstream = await generateProposalsWithOpenRouter({
      inputText,
      requestedCardsCount,
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));

    provider = upstream.provider;
    model = upstream.model;

    const generatedCount = upstream.proposals.length;

    // Mark as success.
    const updateRes = await supabaseAdmin
      .from("ai_generation_requests")
      .update({
        status: "success",
        generated_cards_count: generatedCount,
        provider,
        model,
        error_code: null,
        error_message: null,
      })
      .eq("generation_id", generationId);

    if (updateRes.error) {
      throw new Error(`Failed to update generation log: ${updateRes.error.message}`);
    }

    // MVP: unsigned review token.
    const reviewToken = signReviewToken({ userId, generationId, now });

    // Recompute limits after logging this request (used+1)
    const limitsAfter = await getTodayInlineLimits({ supabaseAdmin, userId, now });

    const success: StartAiGenerationSuccessDto = {
      ok: true,
      generationId,
      reviewToken,
      proposals: upstream.proposals.map((p, idx) => ({
        proposalIndex: idx,
        front: p.front,
        back: p.back,
      })),
      limits: toInlineLimitsDto({
        generationRemaining: limitsAfter.generation.remaining,
        acceptedRemaining: limitsAfter.aiAccepted.remaining,
        resetAt: limitsAfter.resetAt,
      }),
    };

    return { kind: "success", dto: success };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";

    let errorCode: string;
    if (isAbort) {
      errorCode = "OPENROUTER_TIMEOUT";
    } else if (err instanceof Error && err.message.startsWith("OPENROUTER_BAD_RESPONSE")) {
      errorCode = "OPENROUTER_BAD_RESPONSE";
    } else if (err instanceof Error && err.message.startsWith("OPENROUTER_UPSTREAM_ERROR")) {
      errorCode = "OPENROUTER_UPSTREAM_ERROR";
    } else {
      errorCode = "OPENROUTER_UPSTREAM_ERROR";
    }

    // Best-effort update of failure status.
    await supabaseAdmin
      .from("ai_generation_requests")
      .update({
        status: "failure",
        provider: provider ?? "openrouter",
        model: model ?? null,
        error_code: errorCode,
        error_message: safeProviderErrorMessage(errorCode),
      })
      .eq("generation_id", generationId);

    const limitsAfter = await getTodayInlineLimits({ supabaseAdmin, userId, now });

    const failure: StartAiGenerationFailureDto = {
      ok: false,
      generationId,
      error: {
        code: "AI_GENERATION_FAILED",
        message: safeProviderErrorMessage(errorCode),
        details: {
          provider: provider ?? "openrouter",
          model,
        },
      },
      limits: toInlineLimitsDto({
        generationRemaining: limitsAfter.generation.remaining,
        acceptedRemaining: limitsAfter.aiAccepted.remaining,
        resetAt: limitsAfter.resetAt,
      }),
    };

    return { kind: "upstream-failure", dto: failure };
  }
}
