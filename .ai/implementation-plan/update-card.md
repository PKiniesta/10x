# API Endpoint Implementation Plan: Update card

## 1. Przegląd punktu końcowego
Endpoint `PATCH /api/cards/{cardId}` umożliwia zalogowanemu użytkownikowi aktualizację treści istniejącej fiszki (strony przedniej i/lub tylnej). Operacja jest ograniczona do fiszek będących własnością użytkownika.

## 2. Szczegóły żądania
- **Metoda HTTP:** PATCH
- **Struktura URL:** `/api/cards/{cardId}`
- **Parametry:**
    - `cardId` (ścieżka): UUID fiszki do aktualizacji.
- **Request Body:**
  ```json
  {
    "front": "string (opcjonalnie, 1-200 znaków)",
    "back": "string (opcjonalnie, 1-500 znaków)"
  }
  ```
  Przynajmniej jedno z pól powinno być obecne w żądaniu.

## 3. Wykorzystywane typy
- `UpdateCardCommand` (z `src/types.ts`): Model danych wejściowych (Partial).
- `CardDto` (z `src/types.ts`): Model danych wyjściowych.
- `CardEntity` (z `src/types.ts` / `src/db/database.types.ts`): Reprezentacja rekordu w bazie danych.

## 4. Szczegóły odpowiedzi
### Sukces
- **Kod statusu:** 200 OK
- **Body:** `CardDto`
  ```json
  {
    "id": "uuid",
    "front": "string",
    "back": "string",
    "origin": "manual|ai",
    "aiGenerationId": "uuid|null",
    "createdAt": "ISO-TIMESTAMP",
    "updatedAt": "ISO-TIMESTAMP"
  }
  ```

### Błędy
- `400 Bad Request`: `VALIDATION_ERROR` - Dane nie spełniają wymogów długości lub brak pól do aktualizacji.
- `401 Unauthorized`: `AUTH_REQUIRED` - Użytkownik nie jest zalogowany.
- `404 Not Found`: `CARD_NOT_FOUND` - Fiszka o podanym ID nie istnieje lub nie należy do użytkownika.
- `500 Internal Server Error`: `INTERNAL_ERROR` - Błąd serwera.

## 5. Przepływ danych
1. **Odebranie żądania:** Astro API Route (`src/pages/api/cards/[cardId].ts`) przechwytuje żądanie.
2. **Uwierzytelnienie:** Pobranie użytkownika z `Astro.locals.supabase.auth.getUser()`.
3. **Walidacja danych:**
    - Walidacja formatu `cardId` (UUID).
    - Walidacja body za pomocą Zod (`src/lib/validation/cards.ts`). Sprawdzenie długości (front max 200, back max 500) oraz upewnienie się, że nie przesyłamy pustych stringów jeśli pole występuje.
4. **Logika biznesowa:** Wywołanie `CardService.updateCard(cardId, data, userContext)`.
    - Wykonanie zapytania `UPDATE` na tabeli `cards` z filtrem `.eq('id', cardId).eq('user_id', userId)`.
    - Dzięki RLS i dodatkowemu filtrowi po `user_id`, zapytanie nie zaktualizuje cudzych fiszek.
    - Sprawdzenie, czy rekord został zaktualizowany (jeśli zero wierszy -> 404).
5. **Transformacja danych:** Mapowanie wyniku (snake_case) na `CardDto` (camelCase).
6. **Odpowiedź:** Zwrócenie `200 OK` z DTO.

## 6. Względy bezpieczeństwa
- **Autoryzacja:** Ścisłe powiązanie z `user_id` zalogowanego użytkownika.
- **RLS:** Tabela `cards` posiada polityki `USING (user_id = auth.uid())`, co stanowi dodatkową warstwę ochrony.
- **Walidacja:** Zod zapobiega wrzuceniu zbyt dużych tekstów lub nieoczekiwanych typów danych.
- **ID Obfuscation:** Stosowanie UUID zamiast auto-increment ID utrudnia skanowanie zasobów.

## 7. Obsługa błędów
- Przechwytywanie błędów z Supabase SDK.
- Konwersja błędów walidacji Zod na ustandaryzowany format `ApiErrorDto`.
- Obsługa przypadku, gdy `update` zwraca sukces, ale nie zmienił żadnego wiersza (użytkownik podał ID fiszki, która do niego nie należy).

## 8. Rozważania dotyczące wydajności
- Aktualizacja po kluczu głównym (PK) z dodatkowym filtrem po `user_id` (indeks `cards_user_created_at_idx` lub domyślny PK).
- `updated_at` jest obsługiwane automatycznie przez trigger w PostgreSQL, co zdejmuje ten obowiązek z aplikacji.

## 9. Etapy wdrożenia
1. **Walidacja:** Utworzenie/aktualizacja `src/lib/validation/cards.ts` o schemat `updateCardSchema`.
2. **Serwis:**
    - Utworzenie/aktualizacja `src/lib/services/card.service.ts`.
    - Implementacja metody `updateCard` korzystającej z `locals.supabase`.
3. **Punkt końcowy API:**
    - Utworzenie pliku `src/pages/api/cards/[cardId].ts`.
    - Implementacja handlera `PATCH`.
    - `prerender = false` musi być ustawione dla endpointu API.
4. **Testy:**
    - Próba aktualizacji własnej fiszki (sukces 200).
    - Próba aktualizacji nieistniejącej fiszki (błąd 404).
    - Próba aktualizacji fiszki innego użytkownika (błąd 404).
    - Próba wysłania pustych danych lub za długich tekstów (błąd 400).
