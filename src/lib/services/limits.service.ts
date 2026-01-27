import type { SupabaseAdminClient } from "../../db/supabase.admin";

const DAILY_GENERATION_REQUESTS_LIMIT = 10;
const DAILY_AI_ACCEPTED_CARDS_LIMIT = 20;

function getUtcDayWindow(now: Date): { startUtc: Date; resetAt: Date } {
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const resetAt = new Date(startUtc);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { startUtc, resetAt };
}

export async function getTodayInlineLimits(args: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  now: Date;
}): Promise<{
  resetAt: Date;
  generation: { limit: number; used: number; remaining: number };
  aiAccepted: { limit: number; used: number; remaining: number };
}> {
  const { supabaseAdmin, userId, now } = args;

  const { startUtc, resetAt } = getUtcDayWindow(now);

  // Count generation requests (success + failure) for today.
  const genRes = await supabaseAdmin
    .from("ai_generation_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startUtc.toISOString());

  if (genRes.error) {
    throw new Error(`Failed to count generation requests: ${genRes.error.message}`);
  }

  const generationUsed = genRes.count ?? 0;

  // Count accepted proposals for today.
  const accRes = await supabaseAdmin
    .from("ai_proposal_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("accepted", true)
    .gte("created_at", startUtc.toISOString());

  if (accRes.error) {
    throw new Error(`Failed to count accepted proposals: ${accRes.error.message}`);
  }

  const acceptedUsed = accRes.count ?? 0;

  const generationRemaining = Math.max(0, DAILY_GENERATION_REQUESTS_LIMIT - generationUsed);
  const acceptedRemaining = Math.max(0, DAILY_AI_ACCEPTED_CARDS_LIMIT - acceptedUsed);

  return {
    resetAt,
    generation: {
      limit: DAILY_GENERATION_REQUESTS_LIMIT,
      used: generationUsed,
      remaining: generationRemaining,
    },
    aiAccepted: {
      limit: DAILY_AI_ACCEPTED_CARDS_LIMIT,
      used: acceptedUsed,
      remaining: acceptedRemaining,
    },
  };
}
