# Architektura UI dla 10xCards (MVP)

## 1. Przegląd struktury UI

10xCards to aplikacja webowa (PL) do szybkiego tworzenia i zarządzania fiszkami typu front/back oraz generowania propozycji fiszek przez AI z obowiązkowym review.

**Główne obszary UI:**
- **Public (Auth)** – dostępne bez sesji:
  - logowanie, rejestracja, reset hasła, ustawienie nowego hasła.
- **App (chronione)** – dostępne tylko po zalogowaniu:
  - lista fiszek (home), szczegóły + edycja, tworzenie manualne,
  - generowanie AI + review propozycji,
  - (opcjonalnie w przyszłości) metryki/KPI.

**Zasady architektoniczne UI (z PRD + notatek):**
- Jeden typ fiszki: **front (≤200) / back (≤500)** z walidacją w czasie rzeczywistym.
- AI: input **100–1000 znaków** + wybór liczby propozycji **3–12 (domyślnie 8)**.
- Review: działania **per propozycja** (Edytuj/Akceptuj/Odrzuć), brak bulk actions.
- **Limity dzienne**: 10 generowań/dzień i 20 akceptacji AI/dzień; komunikacja limitów widoczna tylko w AI flow.
- Stan listy fiszek utrzymywany w URL: `q`, `page`, `pageSize`, `sort` (domyślnie `createdAt:desc`).
- Propozycje review w MVP są trzymane **wyłącznie w pamięci** (refresh/deep link = brak danych).
- Ochrona tras: wszystkie trasy poza auth są chronione; obsługa 401 jako redirect do `/login?redirectTo=...`.

---

## 2. Lista widoków

### 2.1 Logowanie
- **Nazwa widoku:** Logowanie
- **Ścieżka widoku:** `/login`
- **Główny cel:** Uwierzytelnienie użytkownika dla dostępu do chronionej części aplikacji.
- **Kluczowe informacje do wyświetlenia:**
  - Formularz: email, hasło
  - Linki: „Załóż konto”, „Nie pamiętasz hasła?”
  - Komunikat o błędzie logowania (bez ujawniania, czy email istnieje)
  - Po udanym logowaniu: redirect do `redirectTo` (jeśli podane), inaczej `/cards`
- **Kluczowe komponenty widoku:**
  - Form / Input (email, password), Button (submit), Alert/Callout (błędy), Toast (np. „Sesja wygasła” po 401)
- **UX, dostępność i względy bezpieczeństwa:**
  - Poprawne etykiety, `autocomplete="email"`, `autocomplete="current-password"`
  - Błędy opisowe, ale bez wycieku informacji o istnieniu konta
  - Ochrona przed pętlą redirect (walidacja `redirectTo` jako ścieżka wewnętrzna)

### 2.2 Rejestracja
- **Nazwa widoku:** Rejestracja
- **Ścieżka widoku:** `/register`
- **Główny cel:** Utworzenie konta email/hasło.
- **Kluczowe informacje do wyświetlenia:**
  - Formularz: email, hasło (min. 8 znaków)
  - Link: „Mam konto – zaloguj się”
  - Informacja o wyniku: konto utworzone + przejście do aplikacji lub do logowania (spójnie z wybraną implementacją)
- **Kluczowe komponenty widoku:**
  - Form / Input, walidacja inline, Button, Alert/Toast
- **UX, dostępność i względy bezpieczeństwa:**
  - Walidacja formatu email, minimalnej długości hasła
  - Komunikaty bez ujawniania szczegółów o stanie konta

### 2.3 Reset hasła (inicjacja)
- **Nazwa widoku:** Reset hasła
- **Ścieżka widoku:** `/reset-password`
- **Główny cel:** Zainicjowanie resetu hasła przez email.
- **Kluczowe informacje do wyświetlenia:**
  - Pole email + CTA „Wyślij link resetu”
  - Informacja po wysłaniu: neutralna („Jeśli konto istnieje, wyślemy instrukcję…”) 
- **Kluczowe komponenty widoku:**
  - Form, Input (email), Button, Alert/Toast
- **UX, dostępność i względy bezpieczeństwa:**
  - Brak ujawniania czy email istnieje
  - Copy wystarczająco jasne, co dalej

### 2.4 Ustawienie nowego hasła
- **Nazwa widoku:** Nowe hasło
- **Ścieżka widoku:** `/new-password`
- **Główny cel:** Ustawienie nowego hasła po procesie resetu.
- **Kluczowe informacje do wyświetlenia:**
  - Pole „nowe hasło” + „powtórz hasło” (opcjonalnie)
  - Informacja o sukcesie i przejście do `/login` lub automatyczne zalogowanie
- **Kluczowe komponenty widoku:**
  - Form, Inputs, Button, Alert/Toast
- **UX, dostępność i względy bezpieczeństwa:**
  - Walidacja minimalnej długości
  - Jasne komunikaty błędów tokenu/wygaśnięcia linku (jeśli dotyczy)

---

### 2.5 Lista fiszek (Home)
- **Nazwa widoku:** Lista fiszek
- **Ścieżka widoku:** `/cards`
- **Główny cel:** Przegląd i wyszukiwanie fiszek użytkownika.
- **Kluczowe informacje do wyświetlenia:**
  - Lista fiszek (skrót front/back)
  - Stan ładowania, pusty stan (brak fiszek / brak wyników dla wyszukiwania)
  - Paginacja: poprzednia/następna, numer strony, `total` jeśli dostępne
  - Kontrolki: wyszukiwanie (q), pageSize (20/30/50)
- **Kluczowe komponenty widoku:**
  - SearchInput (debounce 300–500ms)
  - CardsList (elementy listy)
  - CardListItem z akcjami: „Podgląd” (link `/cards/:id`) i „Usuń” (z potwierdzeniem)
  - PaginationControls (Prev/Next + pokazanie `page`, opcjonalnie `total`)
  - PageSizeSelect
  - ConfirmDialog (usunięcie)
- **UX, dostępność i względy bezpieczeństwa:**
  - URL jako źródło prawdy: `q/page/pageSize/sort`; zmiana `q`/`pageSize` resetuje `page=1`
  - Wyszukiwanie od 1 znaku; pusta fraza przywraca pełną listę
  - Potwierdzenie usunięcia (US-012)
  - Obsługa 401: redirect do login + informacja „Sesja wygasła”
  - Kontrolki w pełni klawiaturowe, focus ring, linki jako linki

**Mapowanie na API:**
- GET `/api/cards` (q, page, pageSize, sort)
- DELETE `/api/cards/{cardId}`

---

### 2.6 Nowa fiszka (manual)
- **Nazwa widoku:** Nowa fiszka
- **Ścieżka widoku:** `/cards/new`
- **Główny cel:** Utworzenie fiszki manualnej.
- **Kluczowe informacje do wyświetlenia:**
  - Formularz front/back
  - Liczniki znaków (front/200, back/500)
  - Walidacje inline w czasie rzeczywistym + blokada zapisu przy błędach
  - Po sukcesie: redirect do `/cards` (ustalenie z notatek)
- **Kluczowe komponenty widoku:**
  - CardForm (front/back)
  - CharacterCounter
  - InlineValidationMessages
  - Submit/Cancel actions
- **UX, dostępność i względy bezpieczeństwa:**
  - Walidacje natychmiastowe (US-007)
  - Czytelne komunikaty o przekroczonych limitach (z aktualną długością)
  - Po 401 redirect do login

**Mapowanie na API:**
- POST `/api/cards`

---

### 2.7 Szczegóły fiszki (podgląd + edycja)
- **Nazwa widoku:** Szczegóły fiszki
- **Ścieżka widoku:** `/cards/:id`
- **Główny cel:** Podgląd fiszki oraz edycja front/back w osobnym trybie (bez modala).
- **Kluczowe informacje do wyświetlenia:**
  - Podgląd: front, back, metadane (opcjonalnie: createdAt/updatedAt, origin)
  - Akcje: „Edytuj” → tryb edycji; w edycji: „Anuluj” i „Zapisz”
  - Walidacje inline 200/500
  - Toast po udanym zapisie („Zapisano”)
- **Kluczowe komponenty widoku:**
  - ReadOnlyCardView
  - EditableCardForm (reuse z Create)
  - Button group: Edit / Cancel / Save
  - Toast
- **UX, dostępność i względy bezpieczeństwa:**
  - Tryb edycji nie może gubić danych bez ostrzeżenia przy opuszczaniu (opcjonalne, mile widziane)
  - 404: stan „Nie znaleziono fiszki” + CTA powrotu do `/cards`
  - 401: redirect do login

**Mapowanie na API:**
- GET `/api/cards/{cardId}`
- PATCH `/api/cards/{cardId}`

---

### 2.8 Generuj z AI
- **Nazwa widoku:** Generowanie AI
- **Ścieżka widoku:** `/ai/generate`
- **Główny cel:** Uruchomienie generowania propozycji fiszek przez AI, z kontrolą limitów i walidacją inputu.
- **Kluczowe informacje do wyświetlenia:**
  - Textarea: inputText (100–1000 znaków) + licznik
  - Wybór liczby propozycji (3–12; domyślnie 8)
  - CTA „Generuj” + stan ładowania
  - Wskaźnik limitów (widoczny tylko w AI flow):
    - pozostałe generowania dziś
    - pozostałe akceptacje AI dziś
    - informacja o resecie (UTC `resetAt`)
  - Blokady:
    - input poza zakresem → Generuj disabled z powodem
    - limit generowań = 0 → Generuj disabled + komunikat o resecie
- **Kluczowe komponenty widoku:**
  - AIGenerationForm (textarea, counter, select)
  - LimitsIndicator (callout/alert)
  - PrimaryButton (Generate) + spinner
  - ErrorBanner/Toast (błąd generowania)
- **UX, dostępność i względy bezpieczeństwa:**
  - Tooltip jako preferowane wyjaśnienie disabled (z notatek) + **fallback a11y**: tekst obok przycisku lub `aria-describedby` na wrapperze (bo disabled button nie zawsze wyzwala tooltip)
  - 429 `DAILY_GENERATION_LIMIT_REACHED`: jasny komunikat + `resetAt`
  - 5xx/502: toast „Spróbuj ponownie” + możliwość retry, o ile limit pozwala
  - 401: redirect do login + toast „Sesja wygasła”

**Mapowanie na API:**
- GET `/api/limits/today` (na wejściu)
- POST `/api/ai/generations` (start generacji; response zawiera też limity)

---

### 2.9 Review AI (lista propozycji)
- **Nazwa widoku:** Review AI
- **Ścieżka widoku:** `/ai/review`
- **Główny cel:** Obowiązkowy przegląd propozycji, edycja i decyzje per propozycja.
- **Kluczowe informacje do wyświetlenia:**
  - Lista propozycji z front/back
  - Statusy per propozycja: „pending / accepted / rejected” (w UI)
  - Akcje per propozycja:
    - „Edytuj” (toggle do formularza inline)
    - „Akceptuj” (zapis fiszki, jeśli limit > 0)
    - „Odrzuć” (zawsze możliwe)
  - Wskaźnik limitów (jak w `/ai/generate`) + odświeżany po akceptacji
  - Informacja o konsekwencjach: „propozycje są w pamięci; odświeżenie strony spowoduje utratę danych”
- **Kluczowe komponenty widoku:**
  - AIReviewHeader (nawigacja: powrót do generowania)
  - LimitsIndicator
  - ProposalList + ProposalItem
  - ProposalEditor (front/back + liczniki 200/500 + inline validation)
  - ActionButtons: Edit/Accept/Reject
  - Toast po akceptacji („Zapisano fiszkę” + opcjonalny link „Zobacz fiszkę”)
  - BeforeUnload/RouteLeaveGuard (ostrzeżenie o utracie danych przy opuszczaniu)
- **UX, dostępność i względy bezpieczeństwa:**
  - Gdy brak danych w pamięci (refresh/deep link): stan „Sesja review wygasła / brak danych” + CTA „Wróć do generowania”
  - Limit akceptacji = 0:
    - Akceptuj disabled (z komunikatem + `resetAt`), Odrzuć nadal aktywne
  - Po akceptacji: zablokować ponowne decyzje dla tej propozycji (actions disabled)
  - Obsługa 409 `PROPOSAL_ALREADY_DECIDED`: spójne pokazanie stanu „już podjęto decyzję”
  - 401: redirect do login + toast

**Mapowanie na API:**
- POST `/api/ai/generations/{generationId}/proposals/{proposalIndex}/accept`
- POST `/api/ai/generations/{generationId}/proposals/{proposalIndex}/reject`
- (opcjonalnie) GET `/api/limits/today` jako źródło prawdy na wejściu/po powrocie

---

### 2.10 (Opcjonalnie) Ekran „Not found” / błędy routingu
- **Nazwa widoku:** 404 / Not Found
- **Ścieżka widoku:** np. `/404` lub fallback routingu
- **Główny cel:** Czytelny stan, gdy użytkownik trafi w nieistniejącą trasę.
- **Kluczowe informacje:** krótki opis + CTA do `/cards`.
- **Komponenty:** EmptyState, Button/Link.
- **UX/a11y/bezpieczeństwo:** brak ujawniania szczegółów; nawigacja klawiaturą.

---

## 3. Mapa podróży użytkownika

### 3.1 Główny przypadek użycia: AI → review → zapis fiszek
1. Użytkownik otwiera aplikację.
2. Jeśli brak sesji: trafia na `/login`.
3. Po zalogowaniu przechodzi na `/cards`.
4. Z top-bara wybiera „Generuj z AI” → `/ai/generate`.
5. UI pobiera limity (`/api/limits/today`) i wyświetla wskaźnik.
6. Użytkownik wkleja tekst (100–1000 znaków) i wybiera liczbę propozycji (3–12).
7. Klik „Generuj”:
   - UI wysyła POST `/api/ai/generations`.
   - Na czas oczekiwania: loading + blokada formularza.
8. Sukces:
   - UI zapisuje w pamięci: `generationId`, `reviewToken`, `proposals`.
   - Przejście na `/ai/review`.
9. Na `/ai/review`:
   - Użytkownik iteruje po propozycjach: edycja (opcjonalnie) → akceptacja lub odrzucenie.
   - Akceptacja wywołuje endpoint accept; po sukcesie: toast + oznaczenie propozycji jako accepted.
   - Odrzucenie wywołuje endpoint reject; po sukcesie: oznaczenie jako rejected.
10. Użytkownik może wrócić do `/ai/generate`, ale przed opuszczeniem `/ai/review` UI pokazuje ostrzeżenie o utracie danych propozycji.

**Ścieżka awaryjna:**
- Jeśli użytkownik odświeży `/ai/review` lub wejdzie bez danych: widzi „Sesja review wygasła / brak danych” + CTA do `/ai/generate`.

### 3.2 CRUD manualny
1. Użytkownik na `/cards` wybiera „Generuj manualnie” → `/cards/new`.
2. Wypełnia front/back (walidacja live + liczniki).
3. Zapis (POST `/api/cards`).
4. Po sukcesie: redirect do `/cards` (lista odświeżona).

### 3.3 Edycja istniejącej fiszki
1. Z `/cards` użytkownik klika „Podgląd” → `/cards/:id`.
2. W trybie podglądu klika „Edytuj”.
3. W trybie edycji UI waliduje 200/500.
4. „Zapisz” (PATCH `/api/cards/:id`) → toast „Zapisano” → powrót do podglądu.

### 3.4 Usuwanie fiszki
1. Z `/cards` użytkownik klika „Usuń”.
2. Confirm dialog.
3. Po potwierdzeniu (DELETE `/api/cards/:id`) → element znika z listy.

---

## 4. Układ i struktura nawigacji

### 4.1 Nawigacja globalna (po zalogowaniu)
- **Top-bar** z trzema pozycjami (zgodnie z notatkami):
  1. „Lista fiszek” → `/cards`
  2. „Generuj z AI” → `/ai/generate`
  3. „Generuj manualnie” → `/cards/new`
- Dodatkowo w top-bar (lub menu użytkownika): „Wyloguj”.

### 4.2 Nawigacja kontekstowa
- Na `/cards`: CTA „Nowa fiszka” (opcjonalnie redundantne z top-barem).
- Na `/ai/review`: link „Wróć do generowania” (`/ai/generate`) + mechanizm ostrzegający o utracie danych.
- Po akceptacji propozycji: toast może zawierać link do nowo utworzonej fiszki: `/cards/:id`.

### 4.3 Ochrona tras i redirecty
- Wszystkie trasy aplikacji poza auth są chronione.
- Przy 401 z API:
  - czyścimy stan użytkownika,
  - redirect do `/login?redirectTo=<bieżąca-ścieżka>`
  - toast „Sesja wygasła, zaloguj się ponownie”.

---

## 5. Kluczowe komponenty

Poniższe komponenty pojawiają się w wielu widokach i stabilizują UX oraz spójność:

1. **AppLayout + TopBar**
   - Wspólny layout dla części chronionej: nawigacja, miejsce na treść, globalne toasty.

2. **AuthLayout**
   - Spójna rama dla ekranów auth (nagłówek, krótkie instrukcje, formularz).

3. **Error mapper (UI-level)**
   - Centralny mapper `error.code -> {title, description, severity, retryable}` (z notatek), wykorzystywany przez bannery/toasty.

4. **Toast system (`aria-live`)**
   - Globalne komunikaty sukcesu/błędu (np. „Zapisano”, „Zapisano fiszkę”, „Spróbuj ponownie”, „Sesja wygasła”).

5. **LimitsIndicator (AI flow only)**
   - Callout/alert pokazujący:
     - generationRequests remaining
     - aiAcceptedCards remaining
     - resetAt (UTC)
   - Odświeżany po generowaniu oraz po akceptacji.

6. **CardForm (re-use: create + edit + proposal edit)**
   - Dwa pola front/back z licznikami i walidacją.

7. **ConfirmDialog (delete)**
   - Potwierdzenie destrukcyjnych operacji (US-012), klawiaturowe, focus trap.

8. **Search + URL state helpers**
   - Utrzymanie `q/page/pageSize/sort` w URL, debounce wyszukiwania, reset page.

9. **RouteLeaveGuard / BeforeUnload guard (AI review)**
   - Ostrzeżenie przed utratą danych propozycji trzymanych w pamięci.

---

## 6. Mapowanie wymagań (PRD) na widoki i elementy UI

- **FR-001/FR-002/FR-003** → `/register`, `/login`, `/reset-password`, `/new-password`
- **FR-004 (izolacja danych)** → ochrona tras + spójna obsługa 401 + brak wyświetlania danych bez sesji
- **FR-005/FR-006** → wspólny CardForm (limity 200/500) + walidacja live
- **FR-007/FR-008** → `/cards/new` + redirect po sukcesie do `/cards`
- **FR-009/FR-010** → `/cards` (sort domyślny, paginacja, wyszukiwarka)
- **FR-011** → `/cards/:id` (podgląd + edycja)
- **FR-012** → akcja „Usuń” na liście + confirm dialog
- **FR-013/FR-014/FR-015** → `/ai/generate` (textarea, licznik, wybór 3–12, loading, retry)
- **FR-016/FR-017/FR-018/FR-019** → `/ai/review` (lista propozycji, edycja, akceptacja/odrzucenie, brak bulk)
- **FR-020/FR-021** → LimitsIndicator + blokady generowania/akceptacji + komunikaty + resetAt
- **FR-022/FR-023/FR-024** → realizowane serwerowo przez endpointy AI; UI pokazuje statusy, ale nie wymaga osobnych ekranów KPI w MVP

---

## 7. Potencjalne stany brzegowe i błędy (UI)

1. **401 Unauthorized** (dowolny endpoint):
   - globalny handler → redirect do `/login?redirectTo=...` + toast.

2. **429 limity**:
   - `DAILY_GENERATION_LIMIT_REACHED` na `/ai/generate`: Generuj disabled + komunikat o resecie.
   - `DAILY_AI_ACCEPT_LIMIT_REACHED` na `/ai/review`: Akceptuj disabled, Odrzuć nadal aktywne.

3. **Walidacja inputów**:
   - front/back przekroczone: inline error + blokada zapisu/akceptacji.
   - inputText <100 lub >1000: Generuj disabled + powód.

4. **Brak danych review (in-memory)**:
   - refresh/deep link → empty state + CTA.

5. **404 Not Found**:
   - `CARD_NOT_FOUND`: stan informacyjny na `/cards/:id` + CTA do listy.
   - `GENERATION_NOT_FOUND`: w review pokazujemy błąd i CTA do `/ai/generate`.

6. **409 Conflict** (np. `PROPOSAL_ALREADY_DECIDED`):
   - UI synchronizuje status propozycji jako readonly + komunikat.

7. **Błąd serwera / upstream AI (5xx/502)**:
   - toast „Spróbuj ponownie”, zachowanie zgodne z retryable.

---

## 8. Punkty bólu użytkownika i jak UI je adresuje

- **Niepewność limitów / blokady** → LimitsIndicator + jasne komunikaty + resetAt.
- **Wysokie tarcie przy tworzeniu** → proste formularze, liczniki znaków, walidacja live.
- **Utrata danych review** (in-memory) → ostrzeżenie przy opuszczaniu + jasny empty state po refresh.
- **Chaos na liście** → stan w URL, debounce search, przewidywalna paginacja.
- **Brak zaufania do AI jakości** → obowiązkowy review per propozycja, edycja przed akceptacją.
