# API Endpoint Implementation Plan: Get card by id

## 1. Przegląd punktu końcowego
Endpoint umożliwia pobranie szczegółowych danych pojedynczej fiszki na podstawie jej unikalnego identyfikatora (UUID). Dostęp ograniczony jest wyłącznie do właściciela zasobu.

## 2. Szczegóły żądania
- **Metoda HTTP:** GET
- **Struktura URL:** `/api/cards/[cardId]` (Astro Dynamic Route)
- **Parametry:**
    - `cardId` (Path parameter): Wymagany, format UUID.
- **Request Body:** Brak.

## 3. Wykorzystywane typy
- `CardDto` (z `src/types.ts`): Model odpowiedzi API.
- `CardEntity` (z `src/types.ts`): Model rekordu z bazy danych.
- `ApiErrorDto` (z `src/types.ts`): Model błędu API.
- `Uuid` (z `src/types.ts`): Alias dla string (format UUID).

## 4. Szczegóły odpowiedzi
- **200 OK**: Zwraca obiekt `CardDto`.
- **401 Unauthorized**: W przypadku braku aktywnej sesji użytkownika (`AUTH_REQUIRED`).
- **400 Bad Request**: Gdy `cardId` nie jest prawidłowym UUID (`VALIDATION_ERROR`).
- **404 Not Found**: Gdy fiszka o danym ID nie istnieje lub nie należy do zalogowanego użytkownika (`CARD_NOT_FOUND`).
- **500 Internal Server Error**: Nieoczekiwany błąd serwera (`INTERNAL_ERROR`).

## 5. Przepływ danych
1.  **Router**: Astro przechwytuje żądanie GET na `/api/cards/[cardId]`.
2.  **Autentykacja**: Pobranie użytkownika za pomocą `context.locals.supabase.auth.getUser()`.
3.  **Walidacja**: Sprawdzenie czy `cardId` z parametrów ścieżki jest poprawnym UUID (Zod).
4.  **Service**: Wywołanie `CardsService.getCardById(supabase, userId, cardId)`.
5.  **Database**: Zapytanie do tabeli `cards` z filtrem po `id` oraz `user_id`.
6.  **Mapowanie**: Przekształcenie wyniku (snake_case) na format DTO (camelCase).
7.  **Odpowiedź**: Zwrócenie danych do klienta.

## 6. Względy bezpieczeństwa
- **Autoryzacja**: Każde żądanie musi być zweryfikowane przez Supabase Auth.
- **Izolacja danych (Ownership)**: Zapytanie SQL/Supabase musi jawnie zawierać filtr `user_id`, aby zapobiec IDOR (Insecure Direct Object Reference), mimo istnienia mechanizmów RLS.
- **Walidacja danych**: Ścisła walidacja formatu UUID zapobiega próbom wstrzykiwania kodu/błędnym zapytaniom.

## 7. Obsługa błędów
- Błędy walidacji parametrów zwracane z kodem 400 i szczegółami Zod.
- Brak rekordu lub rekord należący do innego użytkownika traktowany jest identycznie (404), aby nie ujawniać istnienia zasobów.
- Logowanie błędów krytycznych (500) do konsoli serwera (w przyszłości system logowania zewnętrzny).

## 8. Rozważania dotyczące wydajności
- Zapytanie po kluczu głównym (`id`) jest optymalne (indeks B-tree w Postgres).
- Filtr `user_id` również powinien być częścią indeksu lub być wspierany przez RLS.

## 9. Etapy wdrożenia
1.  **Schemat Walidacji**: Utworzenie `src/lib/validation/cards.ts` z definicją `cardIdSchema` (zod string uuid).
2.  **Serwis**:
    - Utworzenie `src/lib/services/cards.service.ts`.
    - Implementacja metody `getCardById` przyjmującej `SupabaseClient`, `userId` i `cardId`.
    - Dodanie logicznego mapowania z `CardEntity` do `CardDto`.
3.  **Endpoint API**:
    - Utworzenie pliku `src/pages/api/cards/[cardId].ts`.
    - Ustawienie `export const prerender = false;`.
    - Implementacja obsługi metody `GET`.
    - Integracja z `CardsService`.
4.  **Testy**: Weryfikacja pobierania własnej fiszki, próba pobrania fiszki innego użytkownika (oczekiwane 404), test niepoprawnego formatu UUID (oczekiwane 400).
