import * as React from "react";

import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/components/hooks/useDebouncedValue";
import { useCardsQueryState } from "@/components/hooks/useCardsQueryState";
import { CardsList } from "@/components/cards/CardsList";
import { PaginationControls } from "@/components/cards/PaginationControls";
import { PageSizeSelect } from "@/components/cards/PageSizeSelect";
import { SearchInput } from "@/components/cards/SearchInput";
import { DeleteCardConfirmDialog } from "@/components/cards/DeleteCardConfirmDialog";
import { deleteCard, listCards, type ApiError } from "@/lib/services/cards.api";
import type { CardDto, ListCardsResponseDto } from "@/types";

type CardsListViewState =
  | { status: "idle" | "loading" }
  | { status: "unauthorized" }
  | { status: "error"; errorMessage: string }
  | { status: "success"; data: ListCardsResponseDto };

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
  }
  return "Nie udało się pobrać listy fiszek.";
}

function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === "object" && "status" in err;
}

export default function CardsListPage() {
  const { state: query, setSearchQuery, setPageSize, setPage } = useCardsQueryState();

  const [searchValue, setSearchValue] = React.useState(query.q ?? "");
  const debouncedSearchValue = useDebouncedValue(searchValue, 400);

  const [view, setView] = React.useState<CardsListViewState>({ status: "idle" });

  const [deleteState, setDeleteState] = React.useState<{
    open: boolean;
    card?: CardDto;
    isPending: boolean;
    errorMessage?: string;
  }>({ open: false, isPending: false });

  const [refreshToken, setRefreshToken] = React.useState(0);

  // Keep the input in sync when URL changes (popstate / external navigation).
  React.useEffect(() => {
    setSearchValue(query.q ?? "");
  }, [query.q]);

  // Apply debounced search to URL.
  React.useEffect(() => {
    const next = debouncedSearchValue.trim();
    if (next === (query.q ?? "")) return;

    setSearchQuery(next);
  }, [debouncedSearchValue, query.q, setSearchQuery]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setView({ status: "loading" });

      try {
        const data = await listCards({
          page: query.page,
          pageSize: query.pageSize,
          q: query.q,
          sort: query.sort,
        });

        if (cancelled) return;
        setView({ status: "success", data });
      } catch (err) {
        if (cancelled) return;

        if (isApiError(err) && err.status === 401) {
          setView({ status: "unauthorized" });
          return;
        }

        setView({ status: "error", errorMessage: getErrorMessage(err) });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [query.page, query.pageSize, query.q, query.sort, refreshToken]);

  const isBusy = view.status === "loading";

  const onCreateClick = React.useCallback(() => {
    globalThis.location.href = "/ai/generate";
  }, []);

  const onDelete = React.useCallback(
    (cardId: string) => {
      if (view.status !== "success") return;

      const card = view.data.data.find((c) => c.id === cardId);
      if (!card) return;

      setDeleteState({ open: true, card, isPending: false });
    },
    [view]
  );

  const onCancelDelete = React.useCallback(() => {
    setDeleteState({ open: false, isPending: false });
  }, []);

  const onConfirmDelete = React.useCallback(async () => {
    if (!deleteState.card) return;

    setDeleteState((prev) => ({ ...prev, isPending: true, errorMessage: undefined }));

    try {
      await deleteCard(deleteState.card.id);

      setDeleteState({ open: false, isPending: false });

      // If we just deleted the last element on a page (and we're not on page 1), go back one page.
      if (view.status === "success") {
        const currentCount = view.data.data.length;
        if (currentCount === 1 && query.page > 1) {
          setPage(query.page - 1);
          return;
        }
      }

      setRefreshToken((x) => x + 1);
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        setDeleteState({ open: false, isPending: false });
        setView({ status: "unauthorized" });
        return;
      }

      setDeleteState((prev) => ({ ...prev, isPending: false, errorMessage: getErrorMessage(err) }));
    }
  }, [deleteState.card, query.page, setPage, view]);

  return (
    <section aria-label="Lista fiszek" className="space-y-6" data-test-id="cards-list-page">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Fiszki</h1>
          <p className="text-sm text-muted-foreground">Przegląd, wyszukiwanie i paginacja Twoich fiszek.</p>
        </div>

        <Button type="button" onClick={onCreateClick}>
          Nowa fiszka AI
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-[420px]">
          <SearchInput value={searchValue} onChange={setSearchValue} disabled={isBusy} />
        </div>
        <PageSizeSelect value={query.pageSize} onChange={setPageSize} disabled={isBusy} />
      </div>

      {view.status === "unauthorized" ? (
        <div className="rounded-lg border bg-background p-4" data-test-id="cards-unauthorized">
          <p className="text-sm">Aby zobaczyć swoje fiszki, musisz się zalogować.</p>
          <div className="mt-3">
            <Button asChild>
              <a
                href={`/login?redirectTo=${encodeURIComponent(globalThis.location.pathname + globalThis.location.search)}`}
                data-test-id="cards-login-button"
              >
                Zaloguj się
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      {view.status === "error" ? (
        <div className="rounded-lg border bg-background p-4" data-test-id="cards-error">
          <p className="text-sm">{view.errorMessage}</p>
        </div>
      ) : null}

      {view.status === "loading" ? (
        <p className="text-sm text-muted-foreground" data-test-id="cards-loading">
          Ładowanie…
        </p>
      ) : null}

      {view.status === "success" && view.data.data.length === 0 ? (
        <div className="rounded-lg border bg-background p-6" data-test-id="cards-empty">
          <p className="text-sm">Brak fiszek do wyświetlenia.</p>
          <div className="mt-3">
            <Button type="button" onClick={onCreateClick}>
              Dodaj pierwszą fiszkę
            </Button>
          </div>
        </div>
      ) : null}

      {view.status === "success" && view.data.data.length > 0 ? (
        <>
          <CardsList
            cards={view.data.data}
            onDelete={onDelete}
            getCardHref={(id) => `/cards/${encodeURIComponent(id)}`}
          />

          <PaginationControls
            page={view.data.page}
            pageSize={view.data.pageSize}
            total={view.data.total}
            currentCount={view.data.data.length}
            onPageChange={setPage}
            disabled={isBusy}
          />
        </>
      ) : null}

      <DeleteCardConfirmDialog
        open={deleteState.open}
        card={deleteState.card}
        isPending={deleteState.isPending}
        errorMessage={deleteState.errorMessage}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </section>
  );
}
