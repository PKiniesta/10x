# API Endpoint Implementation Plan: Create manual card

## 1. Przegląd punktu końcowego
Endpoint `POST /api/cards` umożliwia zalogowanemu użytkownikowi ręczne utworzenie nowej fiszki. Fiszka jest przypisana do użytkownika, posiada treść na przedniej i tylnej stronie oraz jest oznaczona jako utworzona ręcznie (`origin: 'manual'`).

## 2. Szczegóły żądania
- **Metoda HTTP:** POST
- **Struktura URL:** `/api/cards`
- **Parametry:** brak (query params)
- **Request Body:**
  ```json
  {
    "front": "string (1-200 znaków)",
    "back": "string (1-500 znaków)"
  }
  ```

## 3. Wykorzystywane typy
- `CreateManualCardCommand` (z `src/types.ts`): Model danych wejściowych.
- `CardDto` (z `src/types.ts`): Model danych wyjściowych zwróconych w odpowiedzi.
- `CardEntity` (z `src/types.ts` / `src/db/database.types.ts`): Reprezentacja wiersza w tabeli `cards`.

## 4. Szczegóły odpowiedzi
### Sukces
- **Kod statusu:** 201 Created
- **Body:** `CardDto`
  ```json
  {
    "id": "uuid",
    "front": "string",
    "back": "string",
    "origin": "manual",
    "aiGenerationId": null,
    "createdAt": "2024-...",
    "updatedAt": "2024-..."
  }
  ```

### Błędy
- `400 Bad Request`: `VALIDATION_ERROR` - Dane wejściowe nie spełniają wymagań (puste lub za długie).
- `401 Unauthorized`: `AUTH_REQUIRED` - Brak aktywnej sesji użytkownika.
- `500 Internal Server Error`: `INTERNAL_ERROR` - Wystąpił niespodziewany błąd po stronie serwera.

## 5. Przepływ danych
1. **Odebranie żądania:** Astro API Route (`src/pages/api/cards/index.ts`) odbiera żądanie POST.
2. **Uwierzytelnienie:** Sprawdzenie sesji użytkownika przez `Astro.locals.supabase.auth.getUser()`. Jeśli brak sesji, powrót `401`.
3. **Walidacja danych:** Użycie Zod (`src/lib/validation/cards.ts`) do walidacji pól `front` i `back`. Jeśli błąd, powrót `400`.
4. **Logika biznesowa:** Wywołanie `CardService.createManualCard`.
    - Metoda przygotowuje rekord do wstawienia: `user_id` z sesji, `origin: 'manual'`, `ai_generation_id: null`.
    - Wstawienie rekordu do tabeli `cards` za pomocą `supabaseClient`.
5. **Transformacja danych:** Mapowanie `CardEntity` (snake_case) na `CardDto` (camelCase).
6. **Odpowiedź:** Zwrócenie `201 Created` wraz z obiektem `CardDto`.

## 6. Względy bezpieczeństwa
- **Uwierzytelnienie:** Wymagane dla każdego żądania.
- **Autoryzacja (RLS):** Tabela `cards` ma włączony RLS, co gwarantuje, że użytkownik może tworzyć rekordy tylko dla swojego `user_id`.
- **Walidacja wejścia:** Ścisła walidacja długości tekstu (zapobieganie nadmiernemu zużyciu zasobów bazy danych i XSS przy wyświetlaniu).
- **Service Role:** Operacja powinna być wykonywana w kontekście zalogowanego użytkownika (używając jego tokena/klienta), aby RLS zadziałał poprawnie.

## 7. Obsługa błędów
- Błędy walidacji zwracane są z czytelnym komunikatem o błędnych polach (kod `VALIDATION_ERROR`).
- Błędy bazy danych są przechwytywane i logowane na serwerze, klient otrzymuje generyczny błąd `INTERNAL_ERROR`.
- Użycie `ApiErrorDto` dla zachowania spójności formatu błędów.

## 8. Rozważania dotyczące wydajności
- Operacja jest prostym `INSERT` do bazy danych, co jest bardzo wydajne.
- Brak dodatkowych efektów ubocznych (np. wysyłka maili, powiadomienia) w MVP.

## 9. Etapy wdrożenia
1. **Walidacja:** Utworzenie pliku `src/lib/validation/cards.ts` ze schematem Zod dla manualnego tworzenia fiszki.
2. **Serwis:**
    - Utworzenie `src/lib/services/card.service.ts`.
    - Implementacja metody `createManualCard`, która wykonuje INSERT do Supabase.
3. **Punkt końcowy API:**
    - Utworzenie lub aktualizacja `src/pages/api/cards/index.ts`.
    - Implementacja handlera `POST`.
    - Integracja walidacji i serwisu.
4. **Testy:** Weryfikacja endpointu za pomocą narzędzi takich jak Postman/cURL pod kątem sukcesu i obsługi błędów walidacji.
