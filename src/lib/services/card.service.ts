import type { SupabaseClient } from "@/db/supabase.client";
import type {
  CardEntity,
  CardDto,
  CreateManualCardCommand,
  CardOrigin,
  ListCardsResponseDto,
  UpdateCardCommand,
} from "@/types";
import type { ListCardsQueryInput } from "@/lib/validation/cards";

/**
 * Creates a new manual card for the user.
 */
export async function createManualCard(
  supabase: SupabaseClient,
  userId: string,
  command: CreateManualCardCommand
): Promise<CardDto> {
  const { data, error } = await supabase
    .from("cards")
    .insert({
      front: command.front,
      back: command.back,
      user_id: userId,
      origin: "manual",
      ai_generation_id: null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapToCardDto(data);
}

/**
 * Lists cards for the user.
 * Implements pagination, simple search and sorting as per `doc/implementation-plan/list-of-cards.md`.
 */
export async function listCards(
  supabase: SupabaseClient,
  userId: string,
  params: ListCardsQueryInput
): Promise<ListCardsResponseDto> {
  const page = params.page;
  const pageSize = params.pageSize;

  // Guard clauses (should be validated by Zod, but keeps service resilient)
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("INVALID_PAGINATION");
  }
  if (!Number.isInteger(pageSize) || pageSize < 20 || pageSize > 50) {
    throw new Error("INVALID_PAGINATION");
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [sortField, sortDir] = params.sort.split(":");
  if (sortField !== "createdAt" || (sortDir !== "asc" && sortDir !== "desc")) {
    throw new Error("INVALID_SORT");
  }

  // Supabase rows use snake_case.
  const orderColumn = "created_at";
  const ascending = sortDir === "asc";

  let query = supabase
    .from("cards")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order(orderColumn, { ascending })
    .range(from, to);

  if (params.q) {
    const qEscaped = params.q.replaceAll("%", String.raw`\%`).replaceAll("_", String.raw`\_`);
    query = query.or(`front.ilike.%${qEscaped}%,back.ilike.%${qEscaped}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    data: (data ?? []).map(mapToCardDto),
    page,
    pageSize,
    total: count ?? 0,
  };
}

/**
 * Fetches a single card by id for the user.
 * Returns `null` when not found (or belongs to another user).
 */
export async function getCardById(supabase: SupabaseClient, userId: string, cardId: string): Promise<CardDto | null> {
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!cardId) {
    throw new Error("INVALID_CARD_ID");
  }

  const { data, error } = await supabase.from("cards").select("*").eq("id", cardId).eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapToCardDto(data);
}

/**
 * Updates a card (front and/or back) for the user.
 * Returns `null` when card doesn't exist or belongs to another user.
 */
export async function updateCard(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  patch: UpdateCardCommand
): Promise<CardDto | null> {
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!cardId) {
    throw new Error("INVALID_CARD_ID");
  }

  if (!patch.front && !patch.back) {
    throw new Error("VALIDATION_ERROR");
  }

  const updatePayload: UpdateCardCommand = {
    ...(patch.front !== undefined ? { front: patch.front } : {}),
    ...(patch.back !== undefined ? { back: patch.back } : {}),
  };

  const { data, error } = await supabase
    .from("cards")
    .update(updatePayload)
    .eq("id", cardId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapToCardDto(data);
}

/**
 * Deletes a card for the user.
 * Returns `true` when a row was deleted, otherwise `false` (not found or not owned by user).
 */
export async function deleteCard(supabase: SupabaseClient, userId: string, cardId: string): Promise<boolean> {
  if (!userId) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!cardId) {
    throw new Error("INVALID_CARD_ID");
  }

  // We need the deleted row count to distinguish between success vs not-found/not-owned.
  const { error, count } = await supabase
    .from("cards")
    .delete({ count: "exact" })
    .eq("id", cardId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

/**
 * Maps DB entity to DTO.
 */
export function mapToCardDto(entity: CardEntity): CardDto {
  return {
    id: entity.id,
    front: entity.front,
    back: entity.back,
    origin: entity.origin as CardOrigin,
    aiGenerationId: entity.ai_generation_id,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}
