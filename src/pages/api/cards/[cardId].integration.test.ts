import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from "vitest";
import request from "supertest";
import http from "http";
import { server as mswServer } from "@/mocks/server";
import { DELETE } from "./[cardId]";

describe("DELETE /api/cards/[cardId] Integration", () => {
  let mockSupabase: any;

  // We create a minimal HTTP server that wraps the Astro DELETE handler
  // to satisfy the requirement of using supertest for integration tests.
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // Simple path param extraction for /api/cards/:cardId
    const segments = url.pathname.split("/");
    const cardId = segments[segments.length - 1];

    const context = {
      params: { cardId },
      locals: {
        supabase: mockSupabase,
      },
      request: new Request(url.toString(), {
        method: req.method,
        headers: req.headers as any,
      }),
    } as any;

    try {
      const response = await DELETE(context);
      const body = await response.json();
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    } catch (_err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } }));
    }
  });

  beforeAll(() => {
    // Tell MSW to ignore requests to our local test server
    mswServer.close();
  });

  afterAll(() => {
    server.close();
    // Restart MSW server for other tests if needed (though Vitest usually isolates files)
    mswServer.listen({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize a fresh mock for each test
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
  });

  it("should return 401 Unauthorized if no user is found", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth required" },
    });

    const res = await request(server).delete("/api/cards/123e4567-e89b-12d3-a456-426614174000");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("should return 400 Bad Request for invalid UUID format", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const res = await request(server).delete("/api/cards/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 Not Found if card does not exist or not owned by user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Mocking the Supabase chain for delete + eq + eq
    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      // The final call in the service is awaited, so it should be thenable or just return a promise
      then: (resolve: any) => resolve({ data: null, error: null, count: 0 }),
    });

    const res = await request(server).delete("/api/cards/123e4567-e89b-12d3-a456-426614174000");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CARD_NOT_FOUND");
  });

  it("should return 200 OK and ok: true on successful deletion", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data: null, error: null, count: 1 }),
    });

    const res = await request(server).delete("/api/cards/123e4567-e89b-12d3-a456-426614174000");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("should return 500 Internal Server Error if database call fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ error: { message: "DB Connection Error" }, count: null }),
    });

    const res = await request(server).delete("/api/cards/123e4567-e89b-12d3-a456-426614174000");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
