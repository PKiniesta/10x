import type { SupabaseAdminClient } from "../../db/supabase.admin";
import type {
  AcceptAiProposalResponseDto,
  AiInlineLimitsDto,
  CardDto,
  RejectAiProposalResponseDto,
  StartAiGenerationFailureDto,
  StartAiGenerationSuccessDto,
} from "../../types";
import { getTodayInlineLimits } from "./limits.service";
import { generateProposalsWithOpenRouter } from "./openrouter.client";
import { signReviewToken } from "./review-token.service";

function toIso(date: Date): string {
  return date.toISOString();
}

function toInlineLimitsDto(limits: {
  generationRemaining: number;
  acceptedRemaining: number;
  resetAt: Date;
}): AiInlineLimitsDto {
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

export type AcceptAiProposalServiceResult =
  | { kind: "success"; dto: AcceptAiProposalResponseDto }
  | { kind: "limit-reached" }
  | { kind: "generation-not-found" }
  | { kind: "proposal-already-decided" };

export type RejectAiProposalServiceResult =
  | { kind: "success"; dto: RejectAiProposalResponseDto }
  | { kind: "generation-not-found" }
  | { kind: "proposal-already-decided" };

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
  let model: string | undefined | null;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 60_000);

    const upstream = await generateProposalsWithOpenRouter({
      inputText,
      requestedCardsCount,
      signal: ac.signal,
    })
      .catch((e) => console.error(e))
      .finally(() => clearTimeout(timeout));

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

export async function acceptAiProposal(args: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  generationId: string;
  proposalIndex: number;
  front: string;
  back: string;
  reviewToken: string;
  now: Date;
}): Promise<AcceptAiProposalServiceResult> {
  const { supabaseAdmin, userId, generationId, proposalIndex, front, back, now } = args;

  // 1. Check limits.
  const limits = await getTodayInlineLimits({ supabaseAdmin, userId, now });
  if (limits.aiAccepted.remaining <= 0) {
    return { kind: "limit-reached" };
  }

  // 2. Verify generation session ownership.
  const { data: generation, error: genError } = await supabaseAdmin
    .from("ai_generation_requests")
    .select("id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .single();

  if (genError || !generation) {
    return { kind: "generation-not-found" };
  }

  // 3. Check if already decided (using ai_proposal_logs).
  const { data: existingLog } = await supabaseAdmin
    .from("ai_proposal_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("generation_id", generationId)
    .eq("proposal_index", proposalIndex)
    .maybeSingle();

  if (existingLog) {
    return { kind: "proposal-already-decided" };
  }

  // 4. Atomic-ish operation (Supabase doesn't have transactions in JS, so we do it in order).
  // First, create the card.
  const { data: card, error: cardError } = await supabaseAdmin
    .from("cards")
    .insert({
      user_id: userId,
      front,
      back,
      origin: "ai",
      ai_generation_id: generationId,
    })
    .select()
    .single();

  if (cardError) {
    throw new Error(`Failed to create card: ${cardError.message}`);
  }

  // Then, log the proposal decision.
  const { data: proposalLog, error: proposalLogError } = await supabaseAdmin
    .from("ai_proposal_logs")
    .insert({
      user_id: userId,
      generation_id: generationId,
      proposal_index: proposalIndex,
      accepted: true,
      created_card_id: card.id,
    })
    .select()
    .single();

  if (proposalLogError) {
    // If logging fails after card creation, we might have an orphaned card.
    // In a production app, we would use a DB transaction (RPC).
    throw new Error(`Failed to log proposal decision: ${proposalLogError.message}`);
  }

  // 5. Prepare response.
  const cardDto: CardDto = {
    id: card.id,
    front: card.front,
    back: card.back,
    origin: "ai",
    aiGenerationId: card.ai_generation_id,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  };

  const createdCardId = proposalLog.created_card_id;
  if (!createdCardId) {
    throw new Error("Unexpected error: created_card_id is null after insertion");
  }

  return {
    kind: "success",
    dto: {
      card: cardDto,
      log: {
        generationId: proposalLog.generation_id,
        proposalIndex: proposalLog.proposal_index,
        accepted: true,
        createdCardId,
        createdAt: proposalLog.created_at,
      },
      limits: {
        aiAcceptedCardsRemaining: limits.aiAccepted.remaining - 1,
        resetAt: limits.resetAt.toISOString(),
      },
    },
  };
}

export async function rejectAiProposal(args: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  generationId: string;
  proposalIndex: number;
  reviewToken: string;
}): Promise<RejectAiProposalServiceResult> {
  const { supabaseAdmin, userId, generationId, proposalIndex } = args;

  // 1. Verify generation session ownership.
  const { data: generation, error: genError } = await supabaseAdmin
    .from("ai_generation_requests")
    .select("id")
    .eq("generation_id", generationId)
    .eq("user_id", userId)
    .single();

  if (genError || !generation) {
    return { kind: "generation-not-found" };
  }

  // 2. Check if already decided (using ai_proposal_logs).
  const { data: existingLog } = await supabaseAdmin
    .from("ai_proposal_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("generation_id", generationId)
    .eq("proposal_index", proposalIndex)
    .maybeSingle();

  if (existingLog) {
    return { kind: "proposal-already-decided" };
  }

  // 3. Log the rejection.
  const { data: proposalLog, error: proposalLogError } = await supabaseAdmin
    .from("ai_proposal_logs")
    .insert({
      user_id: userId,
      generation_id: generationId,
      proposal_index: proposalIndex,
      accepted: false,
      created_card_id: null,
    })
    .select()
    .single();

  if (proposalLogError) {
    throw new Error(`Failed to log proposal rejection: ${proposalLogError.message}`);
  }

  return {
    kind: "success",
    dto: {
      ok: true,
      log: {
        generationId: proposalLog.generation_id,
        proposalIndex: proposalLog.proposal_index,
        accepted: false,
        createdCardId: null,
        createdAt: proposalLog.created_at,
      },
    },
  };
}
