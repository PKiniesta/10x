# Plan implementacji widoków: Lista fiszek (/cards), Nowa fiszka (/cards/new), Szczegóły/edycja (/cards/:id)

## 1. Przegląd
Celem jest wdrożenie trzech kluczowych widoków CRUD dla fiszek (front/back) zgodnie z PRD i `doc/ui_plan.md`:
- **Lista fiszek (Home)**: przegląd, wyszukiwarka, paginacja, akcja usuwania.
- **Nowa fiszka (manual)**: formularz tworzenia z walidacją „na żywo” i licznikami znaków.
- **Szczegóły fiszki**: podgląd oraz przełączany tryb edycji (bez modala) z walidacją i zapisem.

Widoki korzystają z istniejących endpointów REST w Astro (`src/pages/api/cards/...`) oraz typów DTO z `src/types.ts`. Zgodnie z UI planem stan listy jest źródłowany z URL (query string), a obsługa 401 powinna kierować na logowanie.

> Założenie z opisu zadania: „w tym momencie dostępna bez logowania” dla listy — mimo to backend endpointy wymagają sesji (401). Plan poniżej opisuje implementację UI tak, by:
> 1) działała w trybie zalogowanym (docelowo),
> 2) miała spójne stany dla 401 (komunikat/CTA), co pozwala chwilowo pokazać ekran bez twardej ochrony routingu.

## 2. Routing widoku
Implementowane ścieżki (Astro pages):
- `GET /cards` → `src/pages/cards/index.astro`
- `GET /cards/new` → `src/pages/cards/new.astro`
- `GET /cards/:id` → `src/pages/cards/[cardId].astro`

Dodatkowo (opcjonalnie, ale rekomendowane):
- ustawienie `<title>` per widok w `src/layouts/Layout.astro` przez prop `title`.

## 3. Struktura komponentów
Docelowo większość layoutu jest statyczna w Astro, a interaktywność (formularze, fetch, paginacja, confirm dialog) realizujemy w React.

Proponowana struktura plików:
- `src/pages/cards/index.astro`
  - osadza React: `<CardsListPage client:load />`
- `src/pages/cards/new.astro`
  - osadza React: `<CreateCardPage client:load />`
- `src/pages/cards/[cardId].astro`
  - osadza React: `<CardDetailsPage client:load cardId={Astro.params.cardId} />`

Komponenty React (nowe):
- `src/components/cards/CardsListPage.tsx`
- `src/components/cards/CreateCardPage.tsx`
- `src/components/cards/CardDetailsPage.tsx`
- `src/components/cards/CardForm.tsx` (wspólny formularz create/edit)
- `src/components/cards/CardsList.tsx`
- `src/components/cards/CardListItem.tsx`
- `src/components/cards/PaginationControls.tsx`
- `src/components/cards/PageSizeSelect.tsx`
- `src/components/cards/SearchInput.tsx`
- `src/components/cards/DeleteCardConfirmDialog.tsx`

Hooki / usługi FE (nowe):
- `src/components/hooks/useDebouncedValue.ts`
- `src/components/hooks/useCardsQueryState.ts` (URL ⇄ stan listy)
- `src/components/hooks/useCardForm.ts` (walidacja live + liczniki + dirty state)
- `src/lib/services/cards.api.ts` (fetch wrapper do `/api/cards`)

## 4. Szczegóły komponentów

### 4.1 `CardsListPage`
- **Opis**: Kontener widoku listy. Odpowiada za:
  - synchronizację stanu `q/page/pageSize/sort` z URL,
  - pobranie danych z `GET /api/cards`,
  - obsługę stanów: loading, error, empty, unauthorized,
  - akcję usuwania (dialog + DELETE + odświeżenie listy).
- **Główne elementy**: `main`, nagłówek strony, pasek narzędzi (search + page size), lista, paginacja.
- **Zdarzenia**:
  - `onSearchChange(q)` → update URL, reset `page=1`
  - `onPageSizeChange(pageSize)` → update URL, reset `page=1`
  - `onPageChange(page)` → update URL
  - `onDelete(cardId)` → otwarcie dialogu
  - `onConfirmDelete()` → DELETE + refresh listy
- **Walidacja (UI)**:
  - `page` musi być `>= 1` (guard w hooku; w razie złych query paramów normalizować do domyślnych)
  - `pageSize` tylko `20 | 30 | 50` (UI ogranicza wybór; jeśli URL ma inne, normalizować do `20`)
  - `q` maks 200 znaków (zgodnie z `ListCardsQuerySchema`), trim; pusty string usuwa parametr
  - `sort` tylko `createdAt:desc` (na start bez UI do sortowania, ale parametr w URL ustawiany domyślnie)
- **Typy**:
  - DTO: `ListCardsResponseDto`, `CardDto`
  - ViewModel:
    - `CardsListViewState` (patrz sekcja Typy)
- **Props**: brak (page-level)

### 4.2 `SearchInput`
- **Opis**: Pole wyszukiwania z debounce 300–500ms; jest kontrolowane przez `q` ze stanu URL.
- **Główne elementy**: `input type="search"`, opcjonalny przycisk „Wyczyść”.
- **Zdarzenia**:
  - `onChange` → lokalny stan input
  - debounce → `onDebouncedChange(nextQ)`
  - `onClear` → ustawia `""`
- **Walidacja**:
  - trim, limit 200 znaków (blokada wpisywania po 200 albo pokazanie błędu — preferowane: blokada/ucięcie na 200)
- **Typy**:
  - `value: string`, `onChange(value: string): void`
- **Props**:
  - `value`, `onChange`, `placeholder?`, `disabled?`

### 4.3 `PageSizeSelect`
- **Opis**: Select 20/30/50.
- **Główne elementy**: shadcn `Select` lub prosty `select`.
- **Zdarzenia**: `onValueChange(pageSize)`
- **Walidacja**: wartości tylko z listy.
- **Props**: `value: 20|30|50`, `onChange(value)`

### 4.4 `CardsList`
- **Opis**: Renderuje listę fiszek z `CardListItem`.
- **Główne elementy**: `ul` / `ol`, elementy listy.
- **Zdarzenia**: przekazuje `onDelete`, `onOpen`.
- **Walidacja**: brak.
- **Typy**: `cards: CardDto[]`.
- **Props**:
  - `cards`, `onDelete(cardId)`, `getCardHref(cardId)`

### 4.5 `CardListItem`
- **Opis**: Pojedyncza fiszka na liście, prezentuje skrót front/back i akcje.
- **Główne elementy**: `li`, link do szczegółów (`/cards/:id`), przycisk „Usuń”.
- **Zdarzenia**:
  - klik w link → nawigacja
  - klik „Usuń” → `onDelete(id)`
- **A11y**:
  - „Usuń” jako `<button>` z `aria-label="Usuń fiszkę: {front}"` (lub skrót)
- **Props**: `card: CardDto`, `onDelete(id)`

### 4.6 `PaginationControls`
- **Opis**: Sterowanie paginacją: prev/next + informacja o stronie, opcjonalnie liczba wyników.
- **Główne elementy**: przyciski, tekst `Strona X`, opcjonalnie `z Y` jeśli możliwe.
- **Zdarzenia**:
  - `onPrev` → `page-1`
  - `onNext` → `page+1`
- **Walidacja**:
  - `Prev` disabled gdy `page <= 1`
  - `Next` disabled gdy:
    - znamy `total` i `(page * pageSize) >= total`, albo
    - dla uproszczenia: gdy `data.length < pageSize` (fallback)
- **Props**:
  - `page`, `pageSize`, `total`, `currentCount`, `onPageChange(page)`

### 4.7 `DeleteCardConfirmDialog`
- **Opis**: Potwierdzenie usunięcia (FR-012). Implementacja w oparciu o shadcn `AlertDialog`.
- **Główne elementy**: tytuł, opis, przyciski „Anuluj” i „Usuń”.
- **Zdarzenia**:
  - `onOpenChange(open)`
  - `onConfirm()`
- **Walidacja**: brak.
- **Props**:
  - `open`, `card?: CardDto`, `isPending`, `onCancel()`, `onConfirm()`

---

### 4.8 `CreateCardPage`
- **Opis**: Widok tworzenia fiszki manualnej. Używa wspólnego `CardForm`.
- **Główne elementy**: nagłówek, formularz, przyciski `Zapisz` / `Anuluj`.
- **Zdarzenia**:
  - `onSubmit(values)` → POST `/api/cards`
  - `onCancel` → nawigacja do `/cards`
- **Walidacja (zgodnie z API/PRD)**:
  - `front`: wymagane, długość 1..200
  - `back`: wymagane, długość 1..500
  - walidacja natychmiast podczas wpisywania + przy submit
  - przy błędach: blokada submit
- **Typy**:
  - DTO: `CreateManualCardCommand`, `CardDto`
  - VM: `CardFormValues`, `CardFormErrors`
- **Props**: brak

### 4.9 `CardDetailsPage`
- **Opis**: Widok podglądu i edycji w miejscu.
  - Na wejściu pobiera fiszkę `GET /api/cards/{cardId}`.
  - Pokazuje tryb „podgląd” domyślnie.
  - Przełącza się w tryb edycji (reuse `CardForm`) i zapisuje `PATCH`.
- **Główne elementy**:
  - `ReadOnlyCardView` (może być w tym samym pliku) + przycisk `Edytuj`
  - w trybie edycji: `CardForm` + przyciski `Anuluj` / `Zapisz`
- **Zdarzenia**:
  - `onEnterEdit()`
  - `onCancelEdit()` → powrót do podglądu + reset formularza do ostatnich danych z serwera
  - `onSubmit(patch)` → PATCH `/api/cards/{id}`
- **Walidacja**:
  - takie same limity 200/500
  - w PATCH: wysyłamy tylko zmienione pola (front/back) lub całość — rekomendacja: wysyłać tylko pola zmienione, ale nie jest to wymagane przez API
  - blokada `Zapisz`, gdy brak zmian (dirty=false) albo walidacja nie przechodzi
- **Stany błędów**:
  - 404: „Nie znaleziono fiszki” + CTA do `/cards`
  - 401: stan „Zaloguj się” + przycisk do `/login?redirectTo=/cards/{id}`
- **Typy**:
  - DTO: `CardDto`, `UpdateCardCommand`
  - VM: `CardDetailsViewState`
- **Props**:
  - `cardId: string`

### 4.10 `CardForm` (wspólny)
- **Opis**: Wspólny formularz do create/edit z walidacją live i licznikami znaków.
- **Główne elementy**:
  - `form`
  - pole `front` (input/textarea), licznik `len/200`
  - pole `back` (textarea), licznik `len/500`
  - inline błędy pod polami
- **Zdarzenia**:
  - `onChange(front/back)`
  - `onSubmit`
- **Walidacja (szczegółowo)**:
  - `front`:
    - `trim()` na potrzeby walidacji (UX: użytkownik może wpisać spacje, ale błąd „wymagane” jeśli po trim puste)
    - długość po trim: `>= 1` i `<= 200`
  - `back`:
    - analogicznie, długość po trim: `>= 1` i `<= 500`
  - w trybie edit:
    - jeśli wysyłamy PATCH: przynajmniej jedno z pól musi być obecne w payload (API wymaga). UI powinno pilnować, by nie wysłać pustego patcha.
- **Typy**:
  - `CardFormMode = "create" | "edit"`
  - `CardFormValues = { front: string; back: string }`
  - `CardFormErrors = Partial<Record<keyof CardFormValues, string>> & { form?: string }`
- **Props (interfejs komponentu)**:
  - `mode: CardFormMode`
  - `initialValues?: CardFormValues` (dla edit)
  - `onSubmit(values: CardFormValues): Promise<void> | void`
  - `submitLabel: string`
  - `isSubmitting?: boolean`
  - `disabled?: boolean`
  - `showCancel?: boolean`
  - `onCancel?(): void`

## 5. Typy
Wykorzystujemy istniejące typy z `src/types.ts`:
- `CardDto`
- `ListCardsResponseDto`
- `CreateManualCardCommand`
- `UpdateCardCommand`
- `ApiErrorDto` (do parsowania błędów z API)

Nowe (frontendowe) typy ViewModel / helper types (propozycja umiejscowienia: `src/types.ts` albo lokalnie w komponentach; rekomendacja: lokalnie w `src/components/cards/types.ts` aby nie mieszać z DTO backendu):

### 5.1 `CardsQueryState`
Stan listy jako „źródło prawdy” z URL.
- `q?: string` — fraza wyszukiwania (trim, max 200)
- `page: number` — >= 1
- `pageSize: 20 | 30 | 50`
- `sort: "createdAt:desc" | "createdAt:asc"` (na start używamy tylko `createdAt:desc`)

### 5.2 `CardsListViewState`
- `status: "idle" | "loading" | "success" | "error" | "unauthorized"`
- `data?: ListCardsResponseDto`
- `errorMessage?: string`

### 5.3 `CardDetailsViewState`
- `status: "loading" | "ready" | "notFound" | "error" | "unauthorized"`
- `card?: CardDto`
- `isEditing: boolean`
- `isSaving: boolean`
- `errorMessage?: string`

### 5.4 `CardFormValues`
- `front: string`
- `back: string`

### 5.5 `CardFormFieldErrors`
- `front?: string`
- `back?: string`
- `form?: string` (np. błąd serwera)

### 5.6 `ApiError`
Lekki helper do mapowania błędów HTTP.
- `status: number`
- `code?: ApiErrorDto["error"]["code"]`
- `message: string`
- `details?: unknown`

## 6. Zarządzanie stanem

### 6.1 Stan listy w URL
- Tworzymy hook `useCardsQueryState()`:
  - czyta `window.location.search`
  - normalizuje wartości do `CardsQueryState` (guard clauses)
  - zapewnia settery, które update’ują URL przez `history.pushState`/`replaceState`
  - zasada: zmiana `q` lub `pageSize` ustawia `page=1`

### 6.2 Debounce wyszukiwarki
- Hook `useDebouncedValue(value, delayMs)`.
- `SearchInput` aktualizuje lokalny state natychmiast, a query w URL po debounce.

### 6.3 Stan formularza create/edit
- Hook `useCardForm(initialValues)`:
  - przechowuje `values`, `errors`, `touched`, `isDirty`
  - waliduje live przy zmianie (np. po `onChange`):
    - wstępnie: walidacja długości + wymagane
  - udostępnia `canSubmit` (brak błędów, w edit: dirty=true)

### 6.4 Fetch i synchronizacja
- W `CardsListPage` użyć `useEffect` zależnego od query state (q/page/pageSize/sort) do pobrania listy.
- W `CardDetailsPage` useEffect zależny od `cardId` do pobrania danych.

> Uwaga: brak narzuconej biblioteki do data-fetchingu (React Query/SWR). W MVP można użyć „czystego” fetch + state. Jeśli projekt ma już preferencję, łatwo zamienić.

## 7. Integracja API

### 7.1 Konwencja klienta API
Utworzyć `src/lib/services/cards.api.ts` z funkcjami:
- `listCards(params: { page: number; pageSize: number; q?: string; sort?: string }): Promise<ListCardsResponseDto>`
- `createCard(command: CreateManualCardCommand): Promise<CardDto>`
- `getCard(cardId: string): Promise<CardDto>`
- `updateCard(cardId: string, patch: UpdateCardCommand): Promise<CardDto>`
- `deleteCard(cardId: string): Promise<void>`

Każda funkcja:
- używa `fetch()` na `/api/...`
- jeśli `!res.ok`:
  - próbuje zparsować `ApiErrorDto` i rzuca `ApiError` z `status/code/message`
- zwraca zparsowane DTO

### 7.2 Mapowanie endpointów
- Lista:
  - Request: `GET /api/cards?page=&pageSize=&q=&sort=`
  - Response: `ListCardsResponseDto`
  - 400: `VALIDATION_ERROR` (w implementacji endpointu), w kontrakcie też `INVALID_PAGINATION/INVALID_SORT` — UI i tak prewaliduje
  - 401: `AUTH_REQUIRED`

- Szczegóły:
  - Request: `GET /api/cards/{cardId}`
  - Response: `CardDto`
  - 404: `CARD_NOT_FOUND`
  - 401: `AUTH_REQUIRED`

- Create:
  - Request: `POST /api/cards` body: `CreateManualCardCommand`
  - Response: `CardDto`
  - 400: `VALIDATION_ERROR` (front/back)
  - 401: `AUTH_REQUIRED`

- Update:
  - Request: `PATCH /api/cards/{cardId}` body: `UpdateCardCommand`
  - Response: `CardDto`
  - 400: `VALIDATION_ERROR`
  - 404: `CARD_NOT_FOUND`
  - 401: `AUTH_REQUIRED`

- Delete:
  - Request: `DELETE /api/cards/{cardId}`
  - Response: `{ ok: true }` (UI może zignorować payload)
  - 404/401 jak wyżej

## 8. Interakcje użytkownika

### 8.1 Lista (/cards)
- Wpisanie frazy w wyszukiwarkę:
  - po 300–500ms aktualizuje URL (`q=...`) i resetuje stronę do 1
  - wywołuje ponowny fetch
- Zmiana page size:
  - update URL (`pageSize=...`) + reset `page=1`
  - fetch
- Paginacja:
  - Prev/Next aktualizują `page`
  - fetch
- Klik „Podgląd” / klik w element:
  - przejście do `/cards/:id`
- Klik „Usuń”:
  - otwiera confirm dialog
  - po potwierdzeniu: DELETE
  - po sukcesie: toast „Usunięto”, refresh listy (albo optymistycznie usuń z UI)

### 8.2 Nowa fiszka (/cards/new)
- Wpisywanie w pola:
  - liczniki znaków aktualizują się natychmiast
  - błędy inline pojawiają się w trakcie pisania
- Klik „Zapisz”:
  - jeśli walidacja ok: POST
  - na czas requestu: disable form + loading na przycisku
  - po sukcesie: redirect do `/cards` (FR-008)
- Klik „Anuluj”:
  - nawigacja do `/cards`

### 8.3 Szczegóły (/cards/:id)
- Wejście na stronę:
  - loading skeleton/spinner
  - po sukcesie: podgląd
- Klik „Edytuj”:
  - przełącza w edycję, wypełnia formularz danymi
- Klik „Zapisz”:
  - jeśli dirty i walidacja ok: PATCH
  - po sukcesie: toast „Zapisano”, wyjście z edycji i aktualizacja podglądu
- Klik „Anuluj”:
  - reset form do danych z serwera i powrót do podglądu
- (Opcjonalnie) próba opuszczenia strony w trybie edycji z niezapisanymi zmianami:
  - prompt (beforeunload) lub lekkie ostrzeżenie

## 9. Warunki i walidacja

### 9.1 Walidacja pól fiszki (FR-006, FR-007, FR-011)
Dotyczy: `CardForm` (create i edit)
- `front`:
  - wymagane
  - długość 1..200
- `back`:
  - wymagane
  - długość 1..500
- Walidacja w czasie rzeczywistym:
  - błąd pokazujemy pod polem
  - submit disabled jeśli są błędy

### 9.2 Warunki wynikające z API
Dotyczy: `CardsListPage`, `CardDetailsPage`, `CreateCardPage`
- 401 `AUTH_REQUIRED`:
  - UI pokazuje stan „wymagane logowanie” + CTA do `/login?redirectTo=...`
  - (docelowo) middleware/guard powinien przekierować automatycznie, ale UI powinno być odporne
- 404 `CARD_NOT_FOUND`:
  - tylko w szczegółach i delete/update
  - w szczegółach: osobny empty state
  - w delete: toast „Fiszka już nie istnieje” + refresh listy
- 400 `VALIDATION_ERROR`:
  - dla create/edit: mapować błędy na pola jeśli `details.issues` zawiera ścieżki

### 9.3 Walidacja query listy
Dotyczy: `useCardsQueryState`
- `page`: >= 1
- `pageSize`: 20/30/50 (UI) oraz zgodne z API 20..50
- `q`: trim, max 200
- `sort`: domyślnie `createdAt:desc`

## 10. Obsługa błędów

### 10.1 Kategorie błędów
- **Unauthorized (401)**: pokazać komunikat i CTA do logowania; zachować `redirectTo`.
- **Not found (404)**:
  - `/cards/:id`: stan „Nie znaleziono fiszki”
  - delete/update: toast + powrót/refresh
- **Validation (400)**:
  - create/edit: potraktować jako błąd formularza; najlepiej zmapować na pola
  - list: znormalizować URL i ponowić fetch (lub pokazać błąd „Nieprawidłowe parametry URL” i przycisk „Resetuj filtry”)
- **Network/5xx**: toast/alert „Coś poszło nie tak, spróbuj ponownie” + przycisk retry.

### 10.2 UX błędów
- Unikać „martwych ekranów” — zawsze dać CTA: retry / powrót do listy.
- Logowanie do `console.error` w dev.

## 11. Kroki implementacji
1. **Routing Astro**: utworzyć strony `src/pages/cards/index.astro`, `src/pages/cards/new.astro`, `src/pages/cards/[cardId].astro` z użyciem `Layout.astro` i mountem komponentów React.
2. **Klient API**: dodać `src/lib/services/cards.api.ts` z funkcjami list/get/create/update/delete i wspólnym parserem `ApiErrorDto`.
3. **Hook URL state**: zaimplementować `useCardsQueryState` (parse + normalize + setters);
   - domyślnie ustaw `sort=createdAt:desc`, `page=1`, `pageSize=20`.
4. **Debounce**: dodać `useDebouncedValue`.
5. **Komponenty listy**: `SearchInput`, `PageSizeSelect`, `PaginationControls`, `CardsList`, `CardListItem`.
6. **CardsListPage**: integracja komponentów, fetch `GET /api/cards`, obsługa stanów (loading/empty/error/unauthorized), confirm delete + delete flow.
7. **CardForm + hook formularza**: implementacja wspólnej walidacji, liczników, disabled submit.
8. **CreateCardPage**: integracja `CardForm`, POST `/api/cards`, redirect do `/cards` po sukcesie.
9. **CardDetailsPage**: fetch `GET /api/cards/{id}`, tryb edit, PATCH, stany 404/401, toast po zapisie.
10. **A11y + UX polishing**:
   - poprawne labelki/`aria-*`, focus states,
   - sensowne empty states: brak fiszek / brak wyników.
11. **Testy (minimum)**:
   - testy jednostkowe walidacji (funkcje helper) lub komponentów (jeśli projekt ma test runner),
   - smoke test manualny: create → lista → details → edit → delete.
12. **Spójność stylu**:
   - użyć shadcn/ui (`Button`, `Input`, `Textarea`, `AlertDialog`, `Select`) i Tailwind.
