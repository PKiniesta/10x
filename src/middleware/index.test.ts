import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequest } from "./index";

// Mocking Astro middleware dependencies
vi.mock("astro:middleware", () => ({
  defineMiddleware: vi.fn((fn) => fn),
}));

vi.mock("../db/supabase.admin.ts", () => ({
  createSupabaseAdminClient: vi.fn(() => ({})),
}));

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
};

vi.mock("../db/supabase.client.ts", () => ({
  createSupabaseServerInstance: vi.fn(() => mockSupabase),
}));

describe("Middleware", () => {
  let context: any;
  let next: any;

  beforeEach(() => {
    next = vi.fn(() => Promise.resolve(new Response("ok")));
    context = {
      locals: {},
      cookies: {},
      url: new URL("http://localhost/"),
      request: {
        headers: new Headers(),
      },
      redirect: vi.fn((path) => new Response(null, { status: 302, headers: { Location: path } })),
    };
  });

  it("should redirect guest to /login when accessing protected path", async () => {
    context.url = new URL("http://localhost/cards");

    // Mock user as null
    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

    const response = await (onRequest as any)(context, next);

    expect(context.redirect).toHaveBeenCalledWith("/login");
    expect(response.status).toBe(302);
  });

  it("should allow guest to access public path", async () => {
    context.url = new URL("http://localhost/login");

    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as any);

    await (onRequest as any)(context, next);

    expect(next).toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  });

  it("should redirect logged in user from /login to /cards", async () => {
    context.url = new URL("http://localhost/login");

    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({ data: { session: {} }, error: null } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: { id: "123" } }, error: null } as any);

    const response = await (onRequest as any)(context, next);

    expect(context.redirect).toHaveBeenCalledWith("/cards");
    expect(response.status).toBe(302);
  });

  it("should allow logged in user to access protected path", async () => {
    context.url = new URL("http://localhost/cards");

    vi.mocked(mockSupabase.auth.getSession).mockResolvedValue({ data: { session: {} }, error: null } as any);
    vi.mocked(mockSupabase.auth.getUser).mockResolvedValue({ data: { user: { id: "123" } }, error: null } as any);

    await (onRequest as any)(context, next);

    expect(next).toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  });
});
