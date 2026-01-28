import { describe, it, expect, vi } from "vitest";
import { getTodayInlineLimits } from "./limits.service";
import type { SupabaseAdminClient } from "../../db/supabase.admin";

describe("limits.service", () => {
  const mockSupabaseAdmin = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
  } as unknown as SupabaseAdminClient;

  it("should calculate remaining limits correctly", async () => {
    const now = new Date("2024-01-01T12:00:00Z");

    // Mocking counts
    // 1st call for generation requests (used 3)
    // 2nd call for accepted proposals (used 5)
    vi.mocked(mockSupabaseAdmin.from).mockImplementation((table: string) => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockImplementation(async () => {
          if (table === "ai_generation_requests") {
            return { count: 3, error: null };
          }
          if (table === "ai_proposal_logs") {
            return { count: 5, error: null };
          }
          return { count: 0, error: null };
        }),
      };
      return mockQuery;
    });

    const result = await getTodayInlineLimits({
      supabaseAdmin: mockSupabaseAdmin,
      userId: "test-user",
      now,
    });

    expect(result.generation.used).toBe(3);
    expect(result.generation.remaining).toBe(7); // 10 - 3
    expect(result.aiAccepted.used).toBe(5);
    expect(result.aiAccepted.remaining).toBe(15); // 20 - 5
    expect(result.resetAt.toISOString()).toBe("2024-01-02T00:00:00.000Z");
  });

  it("should throw error if userId is missing", async () => {
    await expect(
      getTodayInlineLimits({
        supabaseAdmin: mockSupabaseAdmin,
        userId: "",
        now: new Date(),
      })
    ).rejects.toThrow("Missing userId for limits computation");
  });

  it("should handle error from supabase", async () => {
    vi.mocked(mockSupabaseAdmin.from).mockImplementation(() => {
        return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ count: null, error: { message: "DB Error", code: "500" } }),
        } as any;
    });

    await expect(
      getTodayInlineLimits({
        supabaseAdmin: mockSupabaseAdmin,
        userId: "test-user",
        now: new Date(),
      })
    ).rejects.toThrow(/Failed to count generation requests/);
  });
});
