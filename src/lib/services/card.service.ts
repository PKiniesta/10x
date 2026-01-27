import type { SupabaseClient } from "@/db/supabase.client";
import type { CardEntity, CardDto, CreateManualCardCommand, CardOrigin } from "@/types";

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
 * Maps DB entity to DTO.
 */
function mapToCardDto(entity: CardEntity): CardDto {
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
