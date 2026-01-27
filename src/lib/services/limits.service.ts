import type { SupabaseAdminClient } from "../../db/supabase.admin";

const DAILY_GENERATION_REQUESTS_LIMIT = 10;
const DAILY_AI_ACCEPTED_CARDS_LIMIT = 20;

function getUtcDayWindow(now: Date): { startUtc: Date; resetAt: Date } {
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const resetAt = new Date(startUtc);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { startUtc, resetAt };
}

function toSupabaseErrorDetails(err: unknown): string {
  if (!err || typeof err !== "object") return "unknown";

  const anyErr = err as Record<string, unknown>;
  const message = typeof anyErr.message === "string" ? anyErr.message : "";
  const code = typeof anyErr.code === "string" ? anyErr.code : "";
  const status = typeof anyErr.status === "number" ? anyErr.status : undefined;

  // Keep it short and safe.
  const parts = [
    code ? `code=${code}` : null,
    typeof status === "number" ? `status=${status}` : null,
    message ? `message=${message}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "unknown";
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

  if (!userId) {
    throw new Error("Missing userId for limits computation");
  }

  const { startUtc, resetAt } = getUtcDayWindow(now);
  const startIso = startUtc.toISOString();

  // Count generation requests (success + failure) for today.
  // Count accepted proposals for today.
  const [genRes, accRes] = await Promise.all([
    supabaseAdmin
      .from("ai_generation_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso),
    supabaseAdmin
      .from("ai_proposal_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("accepted", true)
      .gte("created_at", startIso),
  ]);

  if (genRes.error) {
    const details = toSupabaseErrorDetails(genRes.error);
    throw new Error(
      `Failed to count generation requests (${details}). If this is 401, verify SUPABASE_SERVICE_ROLE_KEY is set and valid for the same SUPABASE_URL.`
    );
  }

  if (accRes.error) {
    const details = toSupabaseErrorDetails(accRes.error);
    throw new Error(
      `Failed to count accepted proposals (${details}). If this is 401, verify SUPABASE_SERVICE_ROLE_KEY is set and valid for the same SUPABASE_URL.`
    );
  }

  const generationUsed = genRes.count ?? 0;
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
