<analysis>
1) Kluczowe punkty specyfikacji API
- Endpoint: POST `/api/ai/generations` (Astro Server Endpoint).
- Cel: uruchomienie generowania propozycji fiszek przez OpenRouter na podstawie długiego tekstu wejściowego.
- Walidacja:
  - `inputText` długość 1000–10000 znaków (w DB logujemy `input_length`).
  - `requestedCardsCount` 3–12.
- Limity dzienne (UTC):
  - 10 żądań generowania/dzień/użytkownik (liczy się sukces i porażka).
  - W odpowiedzi zwracamy też stan limitu akceptacji fiszek AI (20/dzień) jako kontekst dla UI.
- Persistencja:
  - Zawsze tworzymy rekord w `public.ai_generation_requests` przed wywołaniem zewnętrznego provider’a.
  - Po wywołaniu:
    - success: `status=success`, `generated_cards_count`.
    - failure: `status=failure`, `error_code`, `error_message` (bez echo user input).
- Odpowiedź:
  - success: `201 Created` + `generationId`, `reviewToken`, `proposals[]`, `limits{...}`.
  - failure: wg planu API: `502` (albo `500`) + `generationId`, `error{...}`, `limits{...}`.

2) Wymagane i opcjonalne parametry
- Query params: brak.
- Body (JSON):
  - wymagane: `inputText: string`, `requestedCardsCount: number`.
  - opcjonalne: brak.
- Nagłówki:
  - `Content-Type: application/json`.
  - Autoryzacja: sesja Supabase w cookies (odczyt przez `context.locals.supabase.auth.getUser()`).

3) Niezbędne typy DTO i Command modele
- W `src/types.ts` już istnieją:
  - `StartAiGenerationCommand`
  - `AiCardProposalDto`
  - `StartAiGenerationSuccessDto`
  - `StartAiGenerationFailureDto`
  - `StartAiGenerationResponseDto`
  - `AiInlineLimitsDto`
  - `ApiErrorDto`
- Do implementacji endpointa dodatkowo potrzebne wewnętrzne typy (niekoniecznie eksportowane):
  - `OpenRouterRequest/Response` (provider-specific)
  - `ReviewTokenPayload` (np. { sub/userId, generationId, exp, jti })

4) Wyodrębnienie logiki do service
- Endpoint powinien być cienki: parse+validate+auth+call service+map to DTO.
- Nowe serwisy w `src/lib/services`:
  - `aiGenerationService.startGeneration({ userId, inputText, requestedCardsCount, now })`:
    - oblicza limity (generation requests + ai accepts),
    - zapisuje log requestu (insert do `ai_generation_requests`),
    - woła provider’a (OpenRouter),
    - aktualizuje log requestu (update status / counts / error),
    - generuje `reviewToken` i zwraca DTO.
  - `limitsService.getTodayLimits({ userId, now })` lub helper w tym samym serwisie.
  - `openRouterClient.generateProposals({ inputText, requestedCardsCount })`.
  - `reviewTokenService.sign(payload)` / `verify(token)` (dla późniejszych accept/reject).

5) Plan walidacji danych wejściowych
- Zod w endpointcie:
  - `inputText`: string, trim? (uważać by nie zmienić semantyki długości; rekomendacja: walidacja na surowym stringu, ewentualnie normalizacja whitespace dopiero dla promptu).
  - `inputText.length` 1000–10000.
  - `requestedCardsCount`: int 3–12.
- Walidacja JSON:
  - obsłużyć brak/niepoprawny JSON: `400 VALIDATION_ERROR`.
- Walidacja auth:
  - `401 AUTH_REQUIRED`.
- Walidacja limitów:
  - jeśli used >= 10: `429 DAILY_GENERATION_LIMIT_REACHED`.

6) Rejestrowanie błędów
- Nie ma osobnej tabeli błędów; błędy zapisujemy w `ai_generation_requests.error_code` i `error_message`.
- `error_message` musi być „safe”:
  - bez `inputText`
  - bez dumpa odpowiedzi provider’a, jeśli może zawierać treść wejściową
  - dopuszczalne: stałe komunikaty + krótkie wycinki typu provider/model/status.
- Dodatkowo log serwerowy (console / structured logger) może zawierać pełen kontekst, ale nadal uważać na PII i treść edukacyjną (może być wrażliwa).

7) Zagrożenia bezpieczeństwa
- Autoryzacja: endpoint zawsze per-user; nie dopuszczać anon.
- RLS: `ai_generation_requests` nie ma policy insert/update dla authenticated, więc zwykły anon supabase client może nie móc pisać.
  - Potrzebny mechanizm podniesienia uprawnień: rekomendowane RPC SECURITY DEFINER albo serwerowy client z service role.
  - W aktualnym repo middleware wstrzykuje `supabaseClient` oparty o anon key (`SUPABASE_KEY`). To nie wystarczy do zapisów do log tables przy włączonym RLS.
- Token review:
  - musi być podpisany (np. JWT HMAC) i krótko ważny.
  - wiązać z `userId` i `generationId`.
- Abuse / DoS:
  - input 10k znaków * 10 req/day * wielu userów; kontrola limitów + ewentualny rate limit IP.
- SSRF: nie dotyczy.
- Prompt injection: model może generować niepożądane treści; trzeba „hardenować” prompt + walidować output (np. max lengths, format).

8) Scenariusze błędów i statusy
- 400:
  - invalid JSON
  - validation error (inputText length / requestedCardsCount)
- 401:
  - brak sesji
- 429:
  - daily generation limit reached
- 500:
  - błąd DB insert/update (np. brak uprawnień, connectivity)
  - błąd podpisywania tokenu
- 502:
  - OpenRouter timeout / 5xx / niepoprawna odpowiedź
- 201:
  - happy path (generation success)

</analysis>

# API Endpoint Implementation Plan: Start AI generation (`POST /api/ai/generations`)

## 1. Przegląd punktu końcowego
Endpoint uruchamia proces generowania propozycji fiszek (front/back) na podstawie tekstu wejściowego użytkownika. Zanim wywoła zewnętrznego dostawcę AI (OpenRouter), zapisuje próbę generowania do `public.ai_generation_requests` (liczy się do limitu dziennego). Następnie aktualizuje status w DB i zwraca propozycje wraz z krótkotrwałym `reviewToken`, potrzebnym do późniejszego zaakceptowania/odrzucenia propozycji.

**Metoda / ścieżka:** `POST /api/ai/generations`

**Wymogi ogólne:**
- Autentykacja: wymagany zalogowany użytkownik (Supabase Auth, sesja w cookies).
- Walidacja: Zod.
- Implementacja: Astro Server Endpoint w `src/pages/api/ai/generations.ts`.
- Endpoint nie jest prerenderowany: `export const prerender = false`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- URL: `/api/ai/generations`
- Query params: brak
- Nagłówki:
  - `Content-Type: application/json`
  - cookies sesyjne Supabase (po stronie przeglądarki)

### Request Body (JSON)
Wymagane pola:
- `inputText: string`
- `requestedCardsCount: number`

Kontrakt:
- `inputText`:
  - długość **1000–10000** znaków (liczyć jako `inputText.length`)
- `requestedCardsCount`:
  - liczba całkowita **3–12**

## 3. Wykorzystywane typy
Zdefiniowane w `src/types.ts`:
- `StartAiGenerationCommand`
- `StartAiGenerationSuccessDto`
- `StartAiGenerationFailureDto`
- `StartAiGenerationResponseDto`
- `AiCardProposalDto`
- `AiInlineLimitsDto`
- `ApiErrorDto`

Dodatkowe typy/kontrakty (wewnętrzne, rekomendowane):
- `OpenRouterGenerateProposalsResult`:
  - `provider: string`, `model: string`, `proposals: Array<{front:string; back:string}>`
- `ReviewTokenPayload`:
  - `sub: userId`, `generationId`, `exp`, `jti` (unikalny identyfikator tokenu)

## 4. Szczegóły odpowiedzi
### Sukces
- Status: **201 Created**
- Body: `StartAiGenerationSuccessDto`

Wymagane pola:
- `generationId: uuid`
- `reviewToken: string`
- `proposals: AiCardProposalDto[]`
- `limits`:
  - `generationRequestsRemaining: number`
  - `aiAcceptedCardsRemaining: number`
  - `resetAt: ISO string (UTC)`

### Porażka (upstream)
- Status: **502 Bad Gateway** (alternatywnie 500, ale zalecane 502 przy awarii provider’a)
- Body: `StartAiGenerationFailureDto`

Kontrakt:
- Zwracamy **`generationId`** mimo porażki (bo request został zalogowany).
- `error.message` ma być generyczny i bezpieczny.

### Porażka (validation/auth)
- `400 Bad Request`: `ApiErrorDto` (`VALIDATION_ERROR`)
- `401 Unauthorized`: `ApiErrorDto` (`AUTH_REQUIRED`)
- `429 Too Many Requests`: `ApiErrorDto` (`DAILY_GENERATION_LIMIT_REACHED`)
- `500 Internal Server Error`: `ApiErrorDto` (`INTERNAL_ERROR`)

## 5. Przepływ danych
1. **Endpoint** (`src/pages/api/ai/generations.ts`):
   - Parsuje JSON i waliduje Zod schema (`StartAiGenerationCommand`).
   - Pobiera użytkownika z Supabase (`context.locals.supabase.auth.getUser()`).
   - Woła `aiGenerationService.startGeneration(...)`.
   - Mapuje wynik na `StartAiGenerationResponseDto` i ustawia poprawny status HTTP.

2. **Serwis limitów** (w `src/lib/services/limits.service.ts` lub wewnątrz `aiGenerationService`):
   - Wylicza dzisiejsze użycie (UTC) na podstawie:
     - `ai_generation_requests` (generations used)
     - `ai_proposal_logs` (accepted used)
   - Oblicza `resetAt` jako najbliższy `YYYY-MM-DDT00:00:00.000Z` (następny dzień UTC).

3. **Zapis do DB**:
   - Insert do `public.ai_generation_requests`:
     - `user_id`, `input_length`, `requested_cards_count`, `status='failure'| 'success'?` (patrz niżej), `provider`, `model`
     - rekomendacja: na start wstawić `status='failure'` dopiero po provider call? Lepsze: `status='failure'` dopiero przy błędzie, ale DB wymaga `status` NOT NULL.
        - wybieramy alternatywa (zalecana): wykonać insert dopiero *po* pomyślnym provider call, ale wtedy porażki upstream nie liczą się do limitu.
       - W związku ze specyfikacją („writes a row … before calling OpenRouter”), rekomendacja implementacyjna:
         - nie ma zgody na zmiany DB: wprowadzić konwencję `status='failure'` + `error_code='IN_PROGRESS'` i później update do `success` (akceptując „szum” w logach). Zespół musi uzgodnić.

4. **Wywołanie OpenRouter** (`openRouterClient`):
   - Buduje prompt/system message.
   - Ustawia twarde limity:
     - timeout 60s
     - max tokens
   - Wymaga klucza `OPENROUTER_API_KEY` w `import.meta.env` (tylko po stronie serwera).
   - Parsuje wynik do `AiCardProposalDto[]`.
   - Waliduje output:
     - liczba propozycji == `requestedCardsCount` (albo <= i zapisujemy `generated_cards_count`)
     - długości: front <= 200, back <= 500 (przyciąć? lepiej odrzucić i potraktować jako błąd provider’a)

5. **Aktualizacja logu**:
   - On success: `status='success'`, `generated_cards_count`, `provider`, `model`.
   - On failure: `status='failure'`, `error_code`, `error_message`, `provider`, `model`.

6. **Review token** (`reviewTokenService`):
   - Token podpisany i krótko ważny 15min
   - Payload: `sub=userId`, `generationId`, `exp`, `jti`.
   - Zwracany w odpowiedzi success.

## 6. Względy bezpieczeństwa
- **Auth required**: odrzucić gdy brak usera (401).
- **RLS / uprawnienia do log tables**:
  - `ai_generation_requests` i `ai_proposal_logs` nie mają polityk insert/update dla `authenticated`.
  - Implementacja serwera musi wykonywać zapisy z podniesionymi uprawnieniami:
    - opcja A (zalecana i wybrana): Postgres RPC `security definer` do:
      - `log_ai_generation_request_start(...)`
      - `log_ai_generation_request_finish_success(...)`
      - `log_ai_generation_request_finish_failure(...)`
- **Nie wyciekać inputText**:
  - `error_message` w DB i `error.message` w API nie może zawierać `inputText`.
  - logowanie serwerowe: jeśli konieczne, maskować / skracać (np. pierwsze 200 znaków) lub wyłączyć w produkcji.
- **Token review**:
  - podpisany (HMAC/EdDSA), z TTL.
  - zawiera userId żeby nie dało się użyć tokenu innego użytkownika.
- **Ochrona przed nadużyciami**:
  - poza limitem dziennym rozważyć prosty rate-limit (np. per-IP) w middleware/reverse proxy.

## 7. Wydajność
- Liczenia limitów bazują na COUNT z indeksami:
  - `ai_gen_req_user_created_at_idx`
  - `ai_prop_logs_user_created_at_idx`
- Zawsze filtrujemy po `user_id` i `created_at >= todayUtcStart`.
- Unikać wielu roundtripów:
  - łączyć odczyt limitów w jednym RPC lub jednym zapytaniu per tabela.
- OpenRouter:
  - ograniczyć timeout i liczbę tokenów.
  - cache nie jest przydatny (input unikalny), ale można cache’ować modele/config.

## 8. Kroki implementacji
1. **Ustalić mechanizm zapisu do log tables przy RLS**
   - Wybrać: RPC (security definer) vs service role.
   - Jeśli RPC: dodać migrację z funkcjami i minimalnymi uprawnieniami.

2. **Dodać plik endpointu**: `src/pages/api/ai/generations.ts`
   - `export const prerender = false`.
   - Handler `export async function POST(context)`.
   - Guard clauses:
     - sprawdzić `Content-Type` / parse JSON.
     - auth.
     - zod validation.
     - limit check.
   - Wywołać serwis.

3. **Dodać schemy Zod**
   - W `src/lib/validation/ai-generation.ts` (jeśli folder nie istnieje, utworzyć `src/lib/validation`).
   - Schema dla `StartAiGenerationCommand`.

4. **Założyć serwisy**
   - `src/lib/services/ai-generation.service.ts`
   - `src/lib/services/openrouter.client.ts`
   - `src/lib/services/limits.service.ts`
   - `src/lib/services/review-token.service.ts`

5. **Implementacja liczenia limitów (UTC)**
   - helper `getUtcDayWindow(now)` -> `{ startUtc, resetAt }`.
   - queries:
     - generationUsed: count rows in `ai_generation_requests` where `user_id` and `created_at >= startUtc`.
     - acceptedUsed: count rows in `ai_proposal_logs` where `user_id` and `accepted=true` and `created_at >= startUtc`.

6. **Implementacja OpenRouter client**
   - Użyć `fetch` po stronie serwera.
   - Wymaga env `OPENROUTER_API_KEY`.
   - Zwrócić `provider='openrouter'` i `model`.
   - Zastosować walidację output (zod) i mapowanie do `AiCardProposalDto`.

7. **Persistencja i aktualizacja logu**
   - Insert request log przed wywołaniem provider’a.
   - Update log po wyniku.
   - W failure użyć `error_code` przewidywalnego (np. `OPENROUTER_UPSTREAM_ERROR`, `OPENROUTER_TIMEOUT`, `OPENROUTER_BAD_RESPONSE`).

8. **Mapowanie odpowiedzi i kody statusu**
   - success -> 201 + `StartAiGenerationSuccessDto`.
   - upstream failure -> 502 + `StartAiGenerationFailureDto`.
   - validation/auth/limit -> ApiErrorDto z 400/401/429.

10. **Dokumentacja**
   - Upewnić się, że DTO w `src/types.ts` odpowiadają finalnej implementacji.
   - Dodać sekcję w `doc/api_plan.md` jeśli wprowadzono zmiany (np. status `pending`).
