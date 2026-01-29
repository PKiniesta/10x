# API Endpoint Implementation Plan: Delete Card

## 1. Przegląd punktu końcowego
Punkt końcowy `DELETE /api/cards/{cardId}` służy do trwałego usunięcia fiszki z bazy danych. Usunięcie jest dozwolone tylko dla zalogowanego autora fiszki. Operacja ta spowoduje również automatyczne ustawienie kolumny `created_card_id` na `NULL` w powiązanych logach propozycji AI (`ai_proposal_logs`), co jest zapewnione przez strukturę bazy danych (`ON DELETE SET NULL`).

## 2. Szczegóły żądania
- **Metoda HTTP:** `DELETE`
- **Struktura URL:** `/api/cards/{cardId}`
- **Parametry:**
    - **Wymagane:** `cardId` (UUID) przekazywane w ścieżce URL.
    - **Opcjonalne:** Brak.
- **Request Body:** Brak.

## 3. Wykorzystywane typy
- `ApiErrorDto`: Standardowy format błędu (zdefiniowany w `src/types.ts`).
- `SupabaseClient`: Typ klienta Supabase (zdefiniowany w `src/db/supabase.client.ts`).

## 4. Szczegóły odpowiedzi
- **Sukces:** `200 OK`
  ```json
  { "ok": true }
  ```
- **Błędy:**
  - `400 Bad Request`: Gdy `cardId` nie jest poprawnym formatem UUID (`code: "VALIDATION_ERROR"`).
  - `401 Unauthorized`: Gdy użytkownik nie jest zalogowany (`code: "AUTH_REQUIRED"`).
  - `404 Not Found`: Gdy fiszka o podanym ID nie istnieje lub nie należy do zalogowanego użytkownika (`code: "CARD_NOT_FOUND"`).
  - `500 Internal Server Error`: Gdy wystąpi nieoczekiwany błąd serwera lub bazy danych (`code: "INTERNAL_ERROR"`).

## 5. Przepływ danych
1. **Walidacja parametru:** Sprawdzenie czy `cardId` jest poprawnym UUID przy użyciu `zod`.
2. **Uwierzytelnianie:** Pobranie sesji użytkownika z `supabase.auth.getUser()`.
3. **Logika biznesowa (Service):**
   - Wywołanie metody `deleteCard(supabase, cardId, userId)` w `CardsService`.
   - Usunięcie rekordu z tabeli `cards` z uwzględnieniem filtra `user_id` dla zapewnienia bezpieczeństwa.
4. **Odpowiedź:** Zwrócenie wyniku operacji.

## 6. Względy bezpieczeństwa
- **Autoryzacja:** Każde żądanie musi zawierać ważny token sesji.
- **Własność danych:** Usunięcie rekordu jest ograniczone klauzulą `WHERE id = cardId AND user_id = userId`. Dzięki temu użytkownik nie może usunąć fiszki należącej do innej osoby, nawet jeśli zna jej UUID.
- **RLS:** Pomimo walidacji w kodzie, bazy danych Supabase powinny posiadać aktywną polisę Row Level Security (RLS) dla tabeli `cards`, ograniczającą operacje `DELETE` tylko dla właściciela rekordu.

## 7. Obsługa błędów
- Błędy walidacji parametrów zwracane z kodem 400.
- Błędy autoryzacji zwracane z kodem 401.
- Jeśli operacja usunięcia nie dotknęła żadnego wiersza (np. błędne ID lub brak uprawnień), zwracany jest kod 404 zgodnie ze specyfikacją.
- Wszystkie wyjątki są łapane i logowane, a użytkownik otrzymuje standardowy błąd 500.

## 8. Rozważania dotyczące wydajności
- Operacja `DELETE` po kluczu głównym (`id`) jest zoptymalizowana i bardzo szybka dzięki indeksowi PK.
- Kaskadowa operacja `SET NULL` na tabeli `ai_proposal_logs` wymaga istnienia indeksu na kolumnie `created_card_id`, aby uniknąć skanowania sekwencyjnego przy usuwaniu fiszki.

## 9. Etapy wdrożenia
1. **Nowy serwis:** Utworzenie pliku `src/lib/services/cards.service.ts` (jeśli jeszcze nie istnieje).
2. **Metoda serwisu:** Implementacja funkcji `deleteCard` w `CardsService`, która przyjmuje obiekt `SupabaseClient`, `cardId` oraz `userId`.
3. **Endpoint API:** Utworzenie/Edycja pliku `src/pages/api/cards/[cardId].ts`.
4. **Walidacja w endpoincie:** Użycie `zod` do walidacji parametru ścieżki.
5. **Implementacja handlera:** Logika sprawdzająca sesję, wywołująca serwis i zwracająca odpowiedni kod statusu.
6. **Integracja z middleware:** Upewnienie się, że `context.locals.supabase` jest dostępny (już zaimplementowane w middleware).
7. **Testy:** Weryfikacja usunięcia własnej fiszki, próba usunięcia cudzej fiszki oraz próba usunięcia nieistniejącej fiszki.
