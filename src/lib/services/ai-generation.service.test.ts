import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { startAiGeneration, acceptAiProposal, rejectAiProposal } from "./ai-generation.service";
import type { SupabaseAdminClient } from "../../db/supabase.admin";

vi.stubEnv("OPENROUTER_API_KEY", "test-api-key");
vi.stubEnv("OPENROUTER_MODEL", "test-model");

const TEST_USER_ID = "test-user-id-123";
const TEST_GENERATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_CARD_ID = "660e8400-e29b-41d4-a716-446655440001";

function createMockOpenRouterResponse(proposals: { front: string; back: string }[]) {
  return {
    model: "test-model",
    choices: [
      {
        message: {
          content: JSON.stringify({ proposals }),
        },
      },
    ],
  };
}

interface MockSupabaseConfig {
  generationRequestUsed?: number;
  acceptedProposalsUsed?: number;
  insertGenerationResult?: { generation_id: string } | null;
  insertGenerationError?: { message: string } | null;
  updateGenerationError?: { message: string } | null;
  generationExists?: boolean;
  proposalAlreadyDecided?: boolean;
  insertCardResult?: {
    id: string;
    front: string;
    back: string;
    origin: string;
    ai_generation_id: string;
    created_at: string;
    updated_at: string;
  } | null;
  insertCardError?: { message: string } | null;
  insertProposalLogResult?: {
    id: string;
    generation_id: string;
    proposal_index: number;
    accepted: boolean;
    created_card_id: string | null;
    created_at: string;
  } | null;
  insertProposalLogError?: { message: string } | null;
}

function createChainableBuilder(finalResult: { data?: unknown; error?: unknown; count?: number }) {
  const makeChainable = () => {
    const chainable: Record<string, unknown> = {};
    const methods = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "order", "limit", "range"];

    for (const method of methods) {
      chainable[method] = vi.fn().mockReturnValue(chainable);
    }

    chainable.single = vi.fn().mockResolvedValue(finalResult);
    chainable.maybeSingle = vi.fn().mockResolvedValue(finalResult);

    const promise = Promise.resolve(finalResult);
    chainable.then = promise.then.bind(promise);
    chainable.catch = promise.catch.bind(promise);
    chainable.finally = promise.finally.bind(promise);

    return chainable;
  };

  return makeChainable();
}

function createMockSupabaseAdmin(overrides: MockSupabaseConfig = {}): SupabaseAdminClient {
  const {
    generationRequestUsed = 0,
    acceptedProposalsUsed = 0,
    insertGenerationResult = { generation_id: TEST_GENERATION_ID },
    insertGenerationError = null,
    updateGenerationError = null,
    generationExists = true,
    proposalAlreadyDecided = false,
    insertCardResult = null,
    insertCardError = null,
    insertProposalLogResult = null,
    insertProposalLogError = null,
  } = overrides;

  const mockFrom = vi.fn((table: string) => {
    if (table === "ai_generation_requests") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertGenerationError ? null : insertGenerationResult,
              error: insertGenerationError,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue(createChainableBuilder({ error: updateGenerationError })),
        select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return createChainableBuilder({ count: generationRequestUsed, error: null });
          }
          return createChainableBuilder({
            data: generationExists ? { id: "gen-id" } : null,
            error: generationExists ? null : { message: "Not found" },
          });
        }),
      };
    }

    if (table === "ai_proposal_logs") {
      return {
        select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact" && opts?.head === true) {
            return createChainableBuilder({ count: acceptedProposalsUsed, error: null });
          }
          return createChainableBuilder({
            data: proposalAlreadyDecided ? { id: "existing-log" } : null,
            error: null,
          });
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertProposalLogError ? null : insertProposalLogResult,
              error: insertProposalLogError,
            }),
          }),
        }),
      };
    }

    if (table === "cards") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertCardError ? null : insertCardResult,
              error: insertCardError,
            }),
          }),
        }),
      };
    }

    return {};
  });

  return {
    from: mockFrom,
  } as unknown as SupabaseAdminClient;
}

describe("ai-generation.service integration tests", () => {
  const now = new Date("2026-01-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe("startAiGeneration", () => {
    const validInputText = "A".repeat(150);
    const requestedCardsCount = 5;

    it("should successfully generate AI card proposals", async () => {
      const mockProposals = [
        { front: "What is TypeScript?", back: "A typed superset of JavaScript" },
        { front: "What is React?", back: "A JavaScript library for building user interfaces" },
      ];

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(createMockOpenRouterResponse(mockProposals));
        })
      );

      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 2,
        acceptedProposalsUsed: 5,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.dto.ok).toBe(true);
        expect(result.dto.generationId).toBe(TEST_GENERATION_ID);
        expect(result.dto.proposals).toHaveLength(2);
        expect(result.dto.proposals[0].front).toBe("What is TypeScript?");
        expect(result.dto.proposals[0].back).toBe("A typed superset of JavaScript");
        expect(result.dto.limits.generationRequestsRemaining).toBeDefined();
        expect(result.dto.reviewToken).toBeDefined();
      }
    });

    it("should return limit-reached when daily generation limit is exhausted", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 10,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("limit-reached");
    });

    it("should return limit-reached when generation limit is exactly at maximum (10/10)", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 10,
        acceptedProposalsUsed: 0,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("limit-reached");
    });

    it("should allow generation when limit is just under maximum (9/10)", async () => {
      const mockProposals = [{ front: "Q1", back: "A1" }];

      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json(createMockOpenRouterResponse(mockProposals));
        })
      );

      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 9,
        acceptedProposalsUsed: 0,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.dto.ok).toBe(true);
      }
    });

    it("should return upstream-failure when OpenRouter returns an error", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 2,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("upstream-failure");
      if (result.kind === "upstream-failure") {
        expect(result.dto.ok).toBe(false);
        expect(result.dto.error.code).toBe("AI_GENERATION_FAILED");
        expect(result.dto.generationId).toBe(TEST_GENERATION_ID);
      }
    });

    it("should return upstream-failure when OpenRouter returns invalid JSON", async () => {
      server.use(
        http.post("https://openrouter.ai/api/v1/chat/completions", () => {
          return HttpResponse.json({
            model: "test-model",
            choices: [
              {
                message: {
                  content: "This is not valid JSON for proposals",
                },
              },
            ],
          });
        })
      );

      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 2,
      });

      const result = await startAiGeneration({
        supabaseAdmin,
        userId: TEST_USER_ID,
        inputText: validInputText,
        requestedCardsCount,
        now,
      });

      expect(result.kind).toBe("upstream-failure");
      if (result.kind === "upstream-failure") {
        expect(result.dto.ok).toBe(false);
        expect(result.dto.error.code).toBe("AI_GENERATION_FAILED");
      }
    });

    it("should throw error when generation log insert fails", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        generationRequestUsed: 2,
        insertGenerationError: { message: "DB connection error" },
      });

      await expect(
        startAiGeneration({
          supabaseAdmin,
          userId: TEST_USER_ID,
          inputText: validInputText,
          requestedCardsCount,
          now,
        })
      ).rejects.toThrow("Failed to create generation log");
    });
  });

  describe("acceptAiProposal", () => {
    const validFront = "Test front";
    const validBack = "Test back";
    const proposalIndex = 0;
    const reviewToken = "test-review-token";

    it("should successfully accept an AI proposal and create a card", async () => {
      const cardResult = {
        id: TEST_CARD_ID,
        front: validFront,
        back: validBack,
        origin: "ai",
        ai_generation_id: TEST_GENERATION_ID,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const proposalLogResult = {
        id: "log-id",
        generation_id: TEST_GENERATION_ID,
        proposal_index: proposalIndex,
        accepted: true,
        created_card_id: TEST_CARD_ID,
        created_at: now.toISOString(),
      };

      const supabaseAdmin = createMockSupabaseAdmin({
        acceptedProposalsUsed: 5,
        generationExists: true,
        proposalAlreadyDecided: false,
        insertCardResult: cardResult,
        insertProposalLogResult: proposalLogResult,
      });

      const result = await acceptAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        front: validFront,
        back: validBack,
        reviewToken,
        now,
      });

      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.dto.card.id).toBe(TEST_CARD_ID);
        expect(result.dto.card.front).toBe(validFront);
        expect(result.dto.card.back).toBe(validBack);
        expect(result.dto.card.origin).toBe("ai");
        expect(result.dto.log.accepted).toBe(true);
        expect(result.dto.log.createdCardId).toBe(TEST_CARD_ID);
        expect(result.dto.limits.aiAcceptedCardsRemaining).toBe(14);
      }
    });

    it("should return limit-reached when daily accept limit is exhausted", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        acceptedProposalsUsed: 20,
      });

      const result = await acceptAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        front: validFront,
        back: validBack,
        reviewToken,
        now,
      });

      expect(result.kind).toBe("limit-reached");
    });

    it("should return limit-reached when accept limit is exactly at maximum (20/20)", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        acceptedProposalsUsed: 20,
        generationExists: true,
      });

      const result = await acceptAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        front: validFront,
        back: validBack,
        reviewToken,
        now,
      });

      expect(result.kind).toBe("limit-reached");
    });

    it("should return generation-not-found when generation does not exist", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        acceptedProposalsUsed: 5,
        generationExists: false,
      });

      const result = await acceptAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        front: validFront,
        back: validBack,
        reviewToken,
        now,
      });

      expect(result.kind).toBe("generation-not-found");
    });

    it("should return proposal-already-decided when proposal was already decided", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        acceptedProposalsUsed: 5,
        generationExists: true,
        proposalAlreadyDecided: true,
      });

      const result = await acceptAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        front: validFront,
        back: validBack,
        reviewToken,
        now,
      });

      expect(result.kind).toBe("proposal-already-decided");
    });
  });

  describe("rejectAiProposal", () => {
    const proposalIndex = 0;
    const reviewToken = "test-review-token";

    it("should successfully reject an AI proposal", async () => {
      const proposalLogResult = {
        id: "log-id",
        generation_id: TEST_GENERATION_ID,
        proposal_index: proposalIndex,
        accepted: false,
        created_card_id: null,
        created_at: now.toISOString(),
      };

      const supabaseAdmin = createMockSupabaseAdmin({
        generationExists: true,
        proposalAlreadyDecided: false,
        insertProposalLogResult: proposalLogResult,
      });

      const result = await rejectAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        reviewToken,
      });

      expect(result.kind).toBe("success");
      if (result.kind === "success") {
        expect(result.dto.ok).toBe(true);
        expect(result.dto.log.accepted).toBe(false);
        expect(result.dto.log.createdCardId).toBeNull();
      }
    });

    it("should return generation-not-found when generation does not exist", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        generationExists: false,
      });

      const result = await rejectAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        reviewToken,
      });

      expect(result.kind).toBe("generation-not-found");
    });

    it("should return proposal-already-decided when proposal was already decided", async () => {
      const supabaseAdmin = createMockSupabaseAdmin({
        generationExists: true,
        proposalAlreadyDecided: true,
      });

      const result = await rejectAiProposal({
        supabaseAdmin,
        userId: TEST_USER_ID,
        generationId: TEST_GENERATION_ID,
        proposalIndex,
        reviewToken,
      });

      expect(result.kind).toBe("proposal-already-decided");
    });
  });
});
