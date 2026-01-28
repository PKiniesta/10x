import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCardsQueryState } from "./useCardsQueryState";

describe("useCardsQueryState", () => {
  beforeEach(() => {
    // Reset window.location
    vi.stubGlobal("location", {
      pathname: "/cards",
      search: "",
      hash: "",
    });
    vi.stubGlobal("history", {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    });
  });

  it("should initialize with default state when search is empty", () => {
    const { result } = renderHook(() => useCardsQueryState());
    expect(result.current.state).toEqual({
      page: 1,
      pageSize: 20,
      sort: "createdAt:desc",
      q: undefined,
    });
  });

  it("should parse search params on initialization", () => {
    vi.stubGlobal("location", {
      pathname: "/cards",
      search: "?page=2&pageSize=50&q=test&sort=createdAt:asc",
      hash: "",
    });

    const { result } = renderHook(() => useCardsQueryState());
    expect(result.current.state).toEqual({
      page: 2,
      pageSize: 50,
      q: "test",
      sort: "createdAt:asc",
    });
  });

  it("should update URL when setQuery is called", () => {
    const { result } = renderHook(() => useCardsQueryState());

    act(() => {
      result.current.setQuery({ page: 3, q: "new search" });
    });

    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("page=3")
    );
    expect(window.history.pushState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("q=new+search")
    );
    expect(result.current.state.page).toBe(3);
    expect(result.current.state.q).toBe("new search");
  });

  it("should handle replace mode in setQuery", () => {
    const { result } = renderHook(() => useCardsQueryState());

    act(() => {
      result.current.setQuery({ page: 5 }, { replace: true });
    });

    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      expect.stringContaining("page=5")
    );
  });
});
