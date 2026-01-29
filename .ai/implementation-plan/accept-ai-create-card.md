# API Endpoint Implementation Plan: Accept an AI proposal (creates a card)

## 1. Przegląd punktu końcowego
Punkt końcowy `/api/ai/generations/{generationId}/proposals/{proposalIndex}/accept` służy do akceptacji konkretnej propozycji fiszki wygenerowanej przez proces AI. Akceptacja skutkuje utworzeniem nowego rekordu w tabeli `cards` oraz zalogowaniem tej decyzji w tabeli `ai_proposal_logs`. Proces uwzględnia limity dzienne (20 zaakceptowanych propozycji na użytkownika) oraz weryfikację własności sesji generowania.

## 2. Szczegóły żądania
- **Metoda HTTP:** POST
- **Struktura URL:** `/api/ai/generations/:generationId/proposals/:proposalIndex/accept`
- **Parametry ścieżki:**
  - `generationId` (UUID): Identyfikator sesji generowania AI.
  - `proposalIndex` (Integer): Indeks propozycji w danej sesji (liczony od 0).
- **Request Body (JSON):**
  - `front`: string (wymagane, max 200 znaków)
  - `back`: string (wymagane, max 500 znaków)
  - `reviewToken`: string (wymagane, placeholder dla przyszłych zabezpieczeń)

## 3. Wykorzystywane typy
- `AcceptAiProposalCommand`: Dane wejściowe z body.
- `AcceptAiProposalResponseDto`: Struktura odpowiedzi zawierająca obiekt karty, wpis w logu oraz aktualne limity.
- `ApiErrorDto`: Standardowa struktura błędu.
- `CardDto`: Reprezentacja utworzonej fiszki.

## 4. Przepływ danych
1. **Middleware Authorization:** Sprawdzenie, czy użytkownik jest zalogowany (pobranie `userId` z sesji).
2. **Walidacja danych (Zod):**
   - Sprawdzenie poprawności UUID `generationId`.
   - Sprawdzenie poprawności `proposalIndex` (>= 0).
   - Walidacja długości `front` (1-200) i `back` (1-500).
3. **Logika biznesowa (Service Layer):**
   - Wywołanie `AiGenerationService.acceptAiProposal`.
   - Pobranie aktualnych limitów dziennych za pomocą `LimitsService.getTodayInlineLimits`.
   - Sprawdzenie czy limit 20 zaakceptowanych kart nie został przekroczony (429).
   - Weryfikacja w DB, czy `generationId` istnieje i należy do `userId` (404).
   - Sprawdzenie w `ai_proposal_logs`, czy dla danej pary (`generationId`, `proposalIndex`) nie istnieje już wpis (409).
4. **Operacja atomowa (Database Transaction / Order of Operations):**
   - Utworzenie rekordu w `cards` z `origin = 'ai'` i powiązanym `ai_generation_id`.
   - Utworzenie rekordu w `ai_proposal_logs` z `accepted = true` i `created_card_id` wskazującym na nową kartę.
5. **Odpowiedź:** Zwrócenie statusu 201 wraz z danymi karty, logu i nowym stanem limitów.

## 5. Względy bezpieczeństwa
- **Autoryzacja:** Dostęp tylko dla zalogowanych użytkowników.
- **Odizolowanie danych (Ownership):** Walidacja, czy `generationId` faktycznie należy do `userId` z sesji, zapobiega akceptowaniu propozycji innych użytkowników.
- **Service Role:** Użycie `supabaseAdmin` (service-role) w serwisie AI dla operacji na logach, które są chronione przed bezpośrednim dostępem przez RLS (zgodnie z `doc/db_plan.md`).
- **Review Token:** Wstępna walidacja tokenu (w MVP może to być prosty placeholder, docelowo podpisany JWT).

## 6. Obsługa błędów
| Kod stanu | Kod błędu (API) | Opis |
| :--- | :--- | :--- |
| 400 | `VALIDATION_ERROR` | Niepoprawny format danych, przekroczona długość pól lub ujemny indeks. |
| 401 | `AUTH_REQUIRED` | Użytkownik nie jest zalogowany. |
| 404 | `GENERATION_NOT_FOUND` | Sesja generowania nie istnieje lub nie należy do użytkownika. |
| 409 | `PROPOSAL_ALREADY_DECIDED`| Dla tej propozycji podjęto już decyzję (zaakceptowano lub odrzucono). |
| 429 | `DAILY_AI_ACCEPT_LIMIT_REACHED` | Przekroczono limit 20 zaakceptowanych kart na dobę (UTC). |
| 500 | `INTERNAL_ERROR` | Błąd bazy danych lub nieoczekiwany wyjątek po stronie serwera. |

## 7. Rozważania dotyczące wydajności
- **Indeksy:** Wykorzystanie istniejącego unikalnego indeksu na `(user_id, generation_id, proposal_index)` w `ai_proposal_logs` dla szybkiego sprawdzania konfliktów.
- **Limity:** Zoptymalizowane liczenie limitów w `LimitsService` (użycie `count: 'exact', head: true`).
- **Transakcyjność:** Ponieważ Supabase JS SDK nie wspiera natywnych transakcji w tradycyjnym sensie bez RPC, należy zapewnić poprawną kolejność wpisów lub rozważyć prostą funkcję RPC w PostgreSQL, jeśli spójność `cards` vs `ai_proposal_logs` stałaby się krytyczna.

## 8. Etapy wdrożenia
1. **Walidacja wejściowa:** Stworzenie schematu Zod w `src/lib/validation/ai-generation.ts`.
2. **Rozszerzenie serwisu:** Implementacja metody `acceptAiProposal` w `src/lib/services/ai-generation.service.ts`.
3. **Endpoint API:** Stworzenie pliku `src/pages/api/ai/generations/[generationId]/proposals/[proposalIndex]/accept.ts`.
4. **Integracja z listą kart:** Upewnienie się, że nowa karta pojawia się w `/api/cards`.
5. **Testy:**
   - Test pomyślnej akceptacji.
   - Test próby podwójnej akceptacji (409).
   - Test przekroczenia limitu 20 kart (429).
   - Test manipulacji `generationId` (404).
