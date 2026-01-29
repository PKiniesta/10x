import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteCard } from "./card.service";
import type { SupabaseClient } from "../../db/supabase.client";

describe("card.service deleteCard", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  } as unknown as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when a card is successfully deleted", async () => {
    vi.mocked(mockSupabase.from).mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ error: null, count: 1 }),
    } as any);

    const result = await deleteCard(mockSupabase, "user-123", "card-456");

    expect(result).toBe(true);
  });

  it("should return false when card to delete is not found", async () => {
    vi.mocked(mockSupabase.from).mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ error: null, count: 0 }),
    } as any);

    const result = await deleteCard(mockSupabase, "user-123", "card-456");

    expect(result).toBe(false);
  });

  it("should throw error when Supabase returns an error", async () => {
    vi.mocked(mockSupabase.from).mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ error: { message: "DB Error" }, count: null }),
    } as any);

    await expect(deleteCard(mockSupabase, "user-123", "card-456")).rejects.toThrow("DB Error");
  });

  it("should throw AUTH_REQUIRED if userId is missing", async () => {
    await expect(deleteCard(mockSupabase, "", "card-456")).rejects.toThrow("AUTH_REQUIRED");
  });

  it("should throw INVALID_CARD_ID if cardId is missing", async () => {
    await expect(deleteCard(mockSupabase, "user-123", "")).rejects.toThrow("INVALID_CARD_ID");
  });
});
