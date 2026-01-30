# Plan schematu bazy danych (PostgreSQL / Supabase) — 10xCards (MVP)

Poniższy schemat jest zgodny z PRD (`doc/prd.md`), notatkami z planowania (`doc/db_planning.md`) oraz stackiem (Supabase/Postgres). Zakłada:
- brak talii/tagów w MVP,
- fiszki jako rekordy `front/back`,
- logowanie żądań generowania (sukces/porażka) oraz decyzji per propozycja (accepted/rejected),
- egzekwowanie limitów dziennych w DB (UTC),
- RLS dla izolacji danych per użytkownik,
- brak utrwalania treści propozycji AI (przechowujemy tylko metadane + powiązania).

---

## 1. Lista tabel z kolumnami, typami danych i ograniczeniami

> **Schemat**: rekomendowane jest użycie schematu `public` (domyślne w Supabase). W definicjach poniżej zakładam `public.*`.

### 1.1 `cards`
Fiszki użytkownika (manualne lub zaakceptowane z AI).

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**
  - FK → `auth.users(id)` (w Supabase: `references auth.users (id)`)
- `front text` **NOT NULL**
  - CHECK: `char_length(front) <= 200`
- `back text` **NOT NULL**
  - CHECK: `char_length(back) <= 500`
- `origin text` **NOT NULL**
  - CHECK: `origin IN ('manual','ai')`
- `ai_generation_id uuid` NULL
  - CHECK spójności z `origin`:
    - `origin = 'manual' AND ai_generation_id IS NULL`
    - `origin = 'ai' AND ai_generation_id IS NOT NULL`
- `source_title text` NULL
  - (puste w MVP; miejsce na przyszłą minimalną kategoryzację)
- `source_ref text` NULL
  - (puste w MVP; np. rozdział/strona/link; w MVP nieużywane)
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `updated_at timestamptz` **NOT NULL** DEFAULT `now()`

**Uwagi dot. `updated_at`:** rekomendowane dla edycji fiszek (FR-011). Aktualizacja przez trigger (patrz sekcja 5).


### 1.2 `ai_generation_requests`
Log *każdego* żądania generowania (sukces i porażka liczą się do limitu 10/dzień).

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `generation_id uuid` **NOT NULL** DEFAULT `gen_random_uuid()`
  - **UNIQUE** (globalnie) — identyfikator sesji generowania (używany w UI i we wszystkich powiązaniach)
- `user_id uuid` **NOT NULL**
  - FK → `auth.users(id)`
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `input_length integer` **NOT NULL**
  - CHECK: `input_length BETWEEN 100 AND 1000`
- `requested_cards_count integer` **NOT NULL**
  - CHECK: `requested_cards_count BETWEEN 3 AND 12`
- `generated_cards_count integer` NULL
  - CHECK (jeśli nie NULL): `generated_cards_count BETWEEN 0 AND 12`
- `status text` **NOT NULL**
  - CHECK: `status IN ('success','failure')`
- `provider text` NULL
- `model text` NULL
- `error_code text` NULL
- `error_message text` NULL

**Ograniczenia spójności (rekomendowane):**
- CHECK: `status = 'success' => generated_cards_count IS NOT NULL`
- CHECK: `status = 'failure' => generated_cards_count IS NULL OR generated_cards_count >= 0` (dopuszcza częściowe wyniki, jeśli kiedykolwiek będą wspierane)

**Dlaczego osobne `id` i `generation_id`:**
- `generation_id` stabilne dla relacji (FK) i dla logiki aplikacyjnej.
- `id` pozwala łatwo rozszerzać o wersjonowanie/ponowne próby bez zmiany semantyki `generation_id` (a w MVP i tak trzymamy `generation_id` jako `UNIQUE`).


### 1.3 `ai_proposal_logs`
Log decyzji per propozycja w ramach `generation_id` (wymagane do KPI 1).

- `id uuid` **PK** DEFAULT `gen_random_uuid()`
- `user_id uuid` **NOT NULL**
  - FK → `auth.users(id)`
- `generation_id uuid` **NOT NULL**
  - FK → `ai_generation_requests(generation_id)`
- `proposal_index integer` **NOT NULL**
  - CHECK: `proposal_index >= 0`
- `accepted boolean` **NOT NULL**
- `created_at timestamptz` **NOT NULL** DEFAULT `now()`
- `created_card_id uuid` NULL
  - FK → `cards(id)` **ON DELETE SET NULL**

**Unikalność (wymagana):**
- UNIQUE (`user_id`, `generation_id`, `proposal_index`) — nie pozwala zalogować tej samej propozycji dwa razy.

**Spójność: (rekomendowane CHECK)**
- CHECK:
  - `accepted = true` (dopuszcza `created_card_id IS NULL` jeśli fiszka została usunięta — `ON DELETE SET NULL`)
  - `accepted = false => created_card_id IS NULL`


---

## 2. Relacje między tabelami (kardynalność)

1) `auth.users (1) -> (N) cards`
- Jeden użytkownik ma wiele fiszek.
- `cards.user_id` jest właścicielem rekordu i podstawą RLS.

2) `auth.users (1) -> (N) ai_generation_requests`
- Jeden użytkownik może mieć wiele żądań generowania.
- Każde żądanie tworzy rekord niezależnie od sukcesu.

3) `ai_generation_requests (1) -> (N) ai_proposal_logs`
- Jedno żądanie generowania (identyfikowane przez `generation_id`) ma wiele propozycji.
- Dla KPI 1 zakładamy, że *dla każdej wygenerowanej propozycji powstaje rekord* w `ai_proposal_logs` z `accepted=true/false`.

4) `cards (1) <- (0..1) ai_proposal_logs.created_card_id`
- Zaakceptowana propozycja może utworzyć dokładnie jedną fiszkę.
- Dla odrzuconych propozycji `created_card_id` jest NULL.
- Przy hard delete fiszek log nie znika (ON DELETE SET NULL).

5) (opcjonalne, logiczne powiązanie) `cards.ai_generation_id -> ai_generation_requests.generation_id`
- W MVP rekomendowane jako **luźne powiązanie** (kolumna istnieje, ale FK można dodać dopiero po upewnieniu się co do przepływu/retry).
- Jeśli dodajemy FK, preferowane:
  - FK `cards(ai_generation_id)` → `ai_generation_requests(generation_id)`
  - ON DELETE RESTRICT (logi są historyczne i nieusuwalne)

---

## 3. Indeksy

### 3.1 `cards`
- `cards_user_created_at_idx` na (`user_id`, `created_at` DESC)
  - lista (FR-009), paginacja.
- `cards_user_updated_at_idx` na (`user_id`, `updated_at` DESC)
  - opcjonalnie; przydatne, jeśli UI będzie sortować/filtruje po edycji.
- (MVP-search) wyszukiwanie ILIKE:
  - **BRIN/BTREE nie pomoże** na `ILIKE '%term%'`.
  - MVP: bez indeksu dla wyszukiwania (zgodnie z decyzją — prosto, bez optymalizacji).
  - Opcja „później”: GIN trigram (wymaga `pg_trgm`) na `front` i `back`.

### 3.2 `ai_generation_requests`
- `ai_gen_req_user_created_at_idx` na (`user_id`, `created_at` DESC)
  - historia + liczenie limitu 10/dzień.
- `ai_gen_req_generation_id_idx` (UNIQUE/BTREE) na (`generation_id`)
  - szybkie joiny do `ai_proposal_logs`.

### 3.3 `ai_proposal_logs`
- `ai_prop_logs_user_created_at_idx` na (`user_id`, `created_at` DESC)
  - historia + limit 20 accepted/dzień.
- `ai_prop_logs_user_generation_proposal_idx` (UNIQUE) na (`user_id`, `generation_id`, `proposal_index`)
- `ai_prop_logs_generation_id_idx` na (`generation_id`)
  - szybkie zliczanie akceptacji / KPI w ramach generacji.
- `ai_prop_logs_user_created_at_accepted_idx` (partial index) na (`user_id`, `created_at` DESC) WHERE `accepted = true`
  - przyspiesza liczenie limitu 20/dzień.

---

## 4. Zasady PostgreSQL / RLS (Supabase)

### 4.1 Założenia ogólne
- RLS włączone na wszystkich tabelach aplikacyjnych (`cards`, `ai_generation_requests`, `ai_proposal_logs`).
- Izolacja danych: `user_id = auth.uid()`.
- Użytkownik **nie powinien móc** wykonywać bezpośredniego INSERT do tabel logów AI (decyzja z sesji). Zapisy do logów i egzekwowanie limitów realizowane przez:
  - RPC (`SECURITY DEFINER`) *albo*
  - serwer z service-role (backend).

### 4.2 Polityki dla `cards`
**Włącz RLS**: `ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;`

Polityki:
- SELECT: `USING (user_id = auth.uid())`
- INSERT: `WITH CHECK (user_id = auth.uid())`
- UPDATE: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
- DELETE: `USING (user_id = auth.uid())`

Dodatkowo (rekomendowane):
- ograniczyć możliwość ustawienia `origin='ai'` i `ai_generation_id` przez klienta, jeśli akceptacja AI ma iść wyłącznie przez RPC.
  - W praktyce: UI/klient może mieć INSERT tylko dla `origin='manual'`, a AI akceptacja idzie RPC.
  - To można zrobić polityką INSERT z warunkiem:
    - `WITH CHECK (user_id = auth.uid() AND origin = 'manual' AND ai_generation_id IS NULL)`
  - a dla akceptacji AI użyć RPC (SECURITY DEFINER), które inseruje rekord jako owner.

> Jeśli w MVP chcesz umożliwić tworzenie obu typów z klienta (niezalecane), wtedy trzeba polegać na CHECK constraintach + ewentualnych dodatkowych walidacjach.

### 4.3 Polityki dla `ai_generation_requests`
**Włącz RLS**: `ALTER TABLE public.ai_generation_requests ENABLE ROW LEVEL SECURITY;`

- SELECT: `USING (user_id = auth.uid())`
- INSERT/UPDATE/DELETE: **brak polityk** dla roli `authenticated` (czyli domyślnie zablokowane).

Zapisy realizowane:
- przez RPC `SECURITY DEFINER` albo service-role.

### 4.4 Polityki dla `ai_proposal_logs`
**Włącz RLS**: `ALTER TABLE public.ai_proposal_logs ENABLE ROW LEVEL SECURITY;`

- SELECT: `USING (user_id = auth.uid())`
- INSERT/UPDATE/DELETE: **brak polityk** dla roli `authenticated`.

Zapisy realizowane:
- przez RPC `SECURITY DEFINER` albo service-role.

### 4.5 Egzekwowanie limitów w DB (UTC)
Rekomendowane są RPC/funkcje w Postgres, które wykonują atomowo:

1) **Rezerwacja logu żądania generowania** (limit 10/dzień)
- Funkcja tworzy wpis w `ai_generation_requests` (od razu liczy do limitu).
- Sprawdza w transakcji:
  - `count(*)` żądań z `created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')` i `< + interval '1 day'` dla `user_id`.
- Jeśli limit przekroczony → rzuca błąd.
- Zwraca `generation_id`.

2) **Finalizacja statusu generowania**
- Aktualizuje rekord `ai_generation_requests` na `success/failure`, ustawia `generated_cards_count`, `provider/model`, error.
- Może też (opcjonalnie) zapisać „szkielet” logów propozycji w `ai_proposal_logs` (accepted=false) dla wszystkich `proposal_index` od 0..n-1, a potem akceptacja zamienia konkretny indeks na accepted=true.

3) **Akceptacja propozycji** (limit 20/dzień) — jedna transakcja
- Sprawdza limit: `count(*)` w `ai_proposal_logs` gdzie `accepted=true` w bieżącym dniu UTC.
- Waliduje długości 200/500 (na wejściu i przez CHECK constraints).
- Tworzy `cards` z `origin='ai'` i `ai_generation_id = generation_id`.
- Aktualizuje/insertuje `ai_proposal_logs` dla (`user_id`,`generation_id`,`proposal_index`) na `accepted=true` + `created_card_id`.

4) **Odrzucenie propozycji**
- Insert/Upsert do `ai_proposal_logs` z `accepted=false`.

> Implementacja funkcji jest celowo pominięta w tym dokumencie (to plan schematu), ale model tabel i indeksy są pod to przygotowane.

---

## 5. Dodatkowe uwagi / decyzje projektowe

1) **UUID generowane w DB**
- Wszystkie główne tabele mają `uuid` z DEFAULT `gen_random_uuid()` (zgodnie z sesją planowania).
- Wymaga rozszerzenia `pgcrypto` (w Supabase zwykle dostępne): `create extension if not exists pgcrypto;`.

2) **Hard delete dla `cards` + historyczne logi**
- `cards` usuwamy twardo.
- Logi AI zostają; dlatego `ai_proposal_logs.created_card_id` ma FK z `ON DELETE SET NULL`.

3) **Brak przechowywania treści propozycji AI**
- W DB nie ma tabeli na payload propozycji.
- Persistujemy tylko metadane wymagane do limitów i KPI.

4) **Normalizacja (3NF)**
- Brak denormalizacji w MVP.
- `provider/model/error_*` trzymane w `ai_generation_requests` jako atrybuty zdarzenia.

5) **Wyszukiwanie (MVP)**
- Zgodnie z decyzją: proste `ILIKE`.
- Jeśli wydajność stanie się problemem: dodać `pg_trgm` + indeksy GIN lub FTS.

6) **Retencja danych w logach błędów**
- PRD sygnalizuje użytkowników nieletnich; dlatego kolumny `error_message` powinny być używane ostrożnie.
- Rekomendacja praktyczna: trzymać krótki, techniczny komunikat (bez wklejania treści wejścia użytkownika) + `error_code`.

7) **Trigger `updated_at`**
- Rekomendowany trigger dla `cards.updated_at` (before update). To standardowy wzorzec w Postgres/Supabase.

7) **tabela users**
- Korzystamy z wbudowanej `auth.users` w Supabase (nie tworzymy osobnej tabeli użytkowników).

---

### Weryfikacja pokrycia wymagań (mapowanie)
- FR-004 / US-005: `user_id` + RLS na wszystkich tabelach.
- FR-005–FR-006: CHECK constraints na `cards.front/back`.
- FR-009: indeks (`user_id`, `created_at desc`).
- FR-010: możliwe przez `ILIKE` (bez specjalnych indeksów w MVP).
- FR-020–FR-021: logi + indeksy pod zliczanie per dzień (UTC) i blokady realizowane w DB (RPC/service-role).
- FR-022–FR-024: `ai_generation_requests` i `ai_proposal_logs` umożliwiają KPI 1 i KPI 2.
