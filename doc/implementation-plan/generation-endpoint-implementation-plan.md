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
  - failure: `502` (albo `500`) + `generationId`, `error{...}`, `limits{...}`.

2) Wymagane i opcjonalne parametry
- Query params: brak.
- Body (JSON):
  - wymagane: `inputText: string`, `requestedCardsCount: number`.
  - opcjonalne: brak.
- Nagłówki:
  - `Content-Type: application/json`.

3) Niezbędne typy DTO i Command modele
- W `src/types.ts` już istnieją:
  - `StartAiGenerationCommand`
  - `AiCardProposalDto`
  - `StartAiGenerationSuccessDto`
  - `StartAiGenerationFailureDto`
  - `StartAiGenerationResponseDto`
  - `AiInlineLimitsDto`
  - `ApiErrorDto`

4) Wyodrębnienie logiki do service
- Endpoint powinien być cienki: parse+validate+call service+map to DTO.
- Serwisy w `src/lib/services`:
  - `aiGenerationService.startGeneration({ userId, inputText, requestedCardsCount, now })`:
    - oblicza limity (generation requests + ai accepts),
    - zapisuje log requestu (insert do `ai_generation_requests`),
    - woła provider’a (OpenRouter),
    - aktualizuje log requestu (update status / counts / error),
    - generuje `reviewToken` i zwraca DTO.
  - `limitsService.getTodayLimits({ userId, now })` lub helper w tym samym serwisie.
  - `openRouterClient.generateProposals({ inputText, requestedCardsCount })`.
  - `reviewTokenService.sign(...)` (MVP: losowy token; brak weryfikacji).

5) Plan walidacji danych wejściowych
- Zod w endpointcie:
  - `inputText.length` 1000–10000.
  - `requestedCardsCount`: int 3–12.
- Walidacja JSON:
  - obsłużyć brak/niepoprawny JSON: `400 VALIDATION_ERROR`.
- Walidacja limitów:
  - jeżeli used >= 10: `429 DAILY_GENERATION_LIMIT_REACHED`.

6) Rejestrowanie błędów
- Nie ma osobnej tabeli błędów; błędy zapisujemy w `ai_generation_requests.error_code` i `error_message`.
- `error_message` musi być „safe”:
  - bez `inputText`
  - dopuszczalne: stałe komunikaty + krótkie dane typu provider/model/status.

7) Zagrożenia bezpieczeństwa (MVP)
- RLS: log tables nie mają policy insert/update dla anon/authenticated.
  - Zapis realizujemy po stronie serwera przez service role.
- Token review: w MVP jest tylko losowym identyfikatorem (bez podpisu/weryfikacji).

8) Scenariusze błędów i statusy
- 400:
  - invalid JSON
  - validation error (inputText length / requestedCardsCount)
- 429:
  - daily generation limit reached
- 500:
  - błąd DB insert/update (np. brak uprawnień, connectivity)
- 502:
  - OpenRouter timeout / 5xx / niepoprawna odpowiedź
- 201:
  - happy path (generation success)

</analysis>

# API Endpoint Implementation Plan: Start AI generation (`POST /api/ai/generations`)

## 1. Przegląd punktu końcowego
Endpoint uruchamia proces generowania propozycji fiszek (front/back) na podstawie tekstu wejściowego użytkownika. Zanim wywoła zewnętrznego dostawcę AI (OpenRouter), zapisuje próbę generowania do `public.ai_generation_requests` (liczy się do limitu dziennego). Następnie aktualizuje status w DB i zwraca propozycje wraz z `reviewToken`.

**Metoda / ścieżka:** `POST /api/ai/generations`

**Wymogi ogólne (MVP):**
- Auth: brak (używamy mock user id po stronie serwera).
- Walidacja: Zod.
- Implementacja: Astro Server Endpoint w `src/pages/api/ai/generations.ts`.
- Endpoint nie jest prerenderowany: `export const prerender = false`.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- URL: `/api/ai/generations`
- Query params: brak
- Nagłówki:
  - `Content-Type: application/json`

### Request Body (JSON)
Wymagane pola:
- `inputText: string`
- `requestedCardsCount: number`

Kontrakt:
- `inputText`:
  - długość **1000–10000** znaków (liczyć jako `inputText.length`)
- `requestedCardsCount`:
  - liczba całkowita **3–12**

## 5. Przepływ danych
1. **Endpoint** (`src/pages/api/ai/generations.ts`):
   - Parsuje JSON i waliduje Zod schema (`StartAiGenerationCommand`).
   - Ustala `userId` (MVP: mock user id).
   - Woła `aiGenerationService.startGeneration(...)`.
   - Mapuje wynik na `StartAiGenerationResponseDto` i ustawia poprawny status HTTP.

6. **Review token** (`reviewTokenService`)
   - MVP: losowy token (UUID). Brak podpisu i brak weryfikacji.
