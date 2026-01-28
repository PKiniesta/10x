import * as React from "react";

export type CardsQueryState = {
  q?: string;
  page: number;
  pageSize: 20 | 30 | 50;
  sort: "createdAt:desc" | "createdAt:asc";
};

const DEFAULT_STATE: CardsQueryState = {
  page: 1,
  pageSize: 20,
  sort: "createdAt:desc",
};

function clampPage(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STATE.page;
  if (value < 1) return DEFAULT_STATE.page;
  return Math.floor(value);
}

function normalizePageSize(value: string | null): CardsQueryState["pageSize"] {
  if (value === "20") return 20;
  if (value === "30") return 30;
  if (value === "50") return 50;
  return DEFAULT_STATE.pageSize;
}

function normalizeSort(value: string | null): CardsQueryState["sort"] {
  if (value === "createdAt:asc") return "createdAt:asc";
  return DEFAULT_STATE.sort;
}

function normalizeQ(value: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Contract: max 200 chars.
  return trimmed.slice(0, 200);
}

function parseSearch(search: string): CardsQueryState {
  const sp = new URLSearchParams(search);

  const q = normalizeQ(sp.get("q"));
  const pageSize = normalizePageSize(sp.get("pageSize"));
  const page = clampPage(Number(sp.get("page") ?? DEFAULT_STATE.page));
  const sort = normalizeSort(sp.get("sort"));

  return {
    q,
    page,
    pageSize,
    sort,
  };
}

function buildSearch(next: CardsQueryState): string {
  const sp = new URLSearchParams();

  if (next.q) sp.set("q", next.q);
  if (next.page !== DEFAULT_STATE.page) sp.set("page", String(next.page));
  if (next.pageSize !== DEFAULT_STATE.pageSize) sp.set("pageSize", String(next.pageSize));
  if (next.sort !== DEFAULT_STATE.sort) sp.set("sort", String(next.sort));

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useCardsQueryState() {
  const [state, setState] = React.useState<CardsQueryState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...parseSearch(window.location.search) };
  });

  React.useEffect(() => {
    function onPopState() {
      setState({ ...DEFAULT_STATE, ...parseSearch(window.location.search) });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const updateUrl = React.useCallback((next: CardsQueryState, mode: "push" | "replace") => {
    const nextSearch = buildSearch(next);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;

    if (mode === "replace") {
      window.history.replaceState(null, "", nextUrl);
      return;
    }

    window.history.pushState(null, "", nextUrl);
  }, []);

  const setQuery = React.useCallback(
    (patch: Partial<CardsQueryState>, options?: { replace?: boolean }) => {
      setState((prev) => {
        const merged: CardsQueryState = { ...prev, ...patch };
        // Guard clauses + normalization for anything coming from the outside.
        const normalized: CardsQueryState = {
          q: normalizeQ(merged.q ?? null),
          page: clampPage(merged.page),
          pageSize: merged.pageSize,
          sort: merged.sort,
        };

        updateUrl(normalized, options?.replace ? "replace" : "push");
        return normalized;
      });
    },
    [updateUrl]
  );

  const setSearchQuery = React.useCallback(
    (q: string) => {
      const nextQ = normalizeQ(q);
      setQuery({ q: nextQ, page: 1 });
    },
    [setQuery]
  );

  const setPageSize = React.useCallback(
    (pageSize: CardsQueryState["pageSize"]) => {
      setQuery({ pageSize, page: 1 });
    },
    [setQuery]
  );

  const setPage = React.useCallback(
    (page: number) => {
      setQuery({ page });
    },
    [setQuery]
  );

  // On mount, normalize any invalid URL params and clean them up.
  React.useEffect(() => {
    const parsed = { ...DEFAULT_STATE, ...parseSearch(window.location.search) };
    const normalized = {
      q: normalizeQ(parsed.q ?? null),
      page: clampPage(parsed.page),
      pageSize: parsed.pageSize,
      sort: parsed.sort,
    } satisfies CardsQueryState;

    const currentSearch = window.location.search;
    const expectedSearch = buildSearch(normalized);

    if (currentSearch !== expectedSearch) {
      setState(normalized);
      updateUrl(normalized, "replace");
    }
  }, [updateUrl]);

  return {
    state,
    setQuery,
    setSearchQuery,
    setPageSize,
    setPage,
  };
}
