# API Endpoint Implementation Plan: List cards

## 1. Przegląd punktu końcowego
Endpoint `GET /api/cards` służy do pobierania listy fiszek zalogowanego użytkownika. Wyniki są sortowane domyślnie od najnowszych i obsługują paginację oraz proste wyszukiwanie tekstowe w polach `front` i `back`.

## 2. Szczegóły żądania
- **Metoda HTTP:** `GET`
- **Struktura URL:** `/api/cards`
- **Parametry:**
    - **Opcjonalne:**
        - `page` (number): Numer strony, domyślnie `1`. Musi być >= 1.
        - `pageSize` (number): Rozmiar strony, domyślnie `20`. Zakres: 20-50.
        - `q` (string): Fraza wyszukiwania (szuka w `front` i `back`).
        - `sort` (string): Pole i kierunek sortowania, domyślnie `createdAt:desc`. Dozwolone wartości: `createdAt:asc`, `createdAt:desc`.
- **Request Body:** Brak

## 3. Wykorzystywane typy
- `CardDto`: Struktura pojedynczej fiszki zwracanej przez API.
- `PaginatedResponse<CardDto>`: Generyczny typ odpowiedzi paginowanej.
- `ApiErrorCode`: Kody błędów (`AUTH_REQUIRED`, `INVALID_PAGINATION`, `INVALID_SORT`, `INTERNAL_ERROR`).
- `ApiErrorDto`: Standardowa struktura błędu.

## 4. Przepływ danych
1. **Middleware/Auth:** Sprawdzenie sesji użytkownika przez `Astro.locals.supabase.auth.getUser()`. Jeśli brak sesji -> 401.
2. **Walidacja:** Walidacja parametrów query za pomocą Zod (schema w `src/lib/validation/cards.ts`). Jeśli błędy -> 400.
3. **Service Layer:** Wywołanie `CardsService.listCards(userId, params)`.
    - Budowa zapytania PostgREST do tabeli `cards`.
    - Filtrowanie po `user_id`.
    - Jeśli podano `q`, dodanie warunku `.or(front.ilike.%${q}%,back.ilike.%${q}%)`.
    - Paginacja za pomocą `.range(from, to)`.
    - Sortowanie zgodnie z parametrem `sort`.
    - Pobranie danych wraz z całkowitą liczbą rekordów (`count: 'exact'`).
4. **Transformacja:** Mapowanie wyników z bazy (snake_case) na format DTO (camelCase).
5. **Odpowiedź:** Zwrócenie obiektu `PaginatedResponse<CardDto>` z kodem 200.

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie:** Endpoint wymaga aktywnej sesji Supabase.
- **Autoryzacja (Multi-tenancy):** Każde zapytanie do bazy musi zawierać filtr `user_id = auth.uid()`. Dodatkowo RLS na poziomie bazy danych zapewnia izolację.
- **Walidacja wejścia:** Ścisła walidacja `pageSize` (max 50) zapobiega atakom typu Denial of Service poprzez żądanie ogromnych zbiorów danych.
- **SQL Injection:** Użycie Supabase SDK (PostgREST) automatycznie chroni przed wstrzykiwaniem SQL.

## 6. Obsługa błędów
- `401 Unauthorized`: Brak zalogowanego użytkownika (kod `AUTH_REQUIRED`).
- `400 Bad Request`: 
    - Błędne parametry paginacji (kod `INVALID_PAGINATION`).
    - Nieprawidłowy format sortowania (kod `INVALID_SORT`).
    - Błędy walidacji Zod (kod `VALIDATION_ERROR`).
- `500 Internal Server Error`: Nieoczekiwane błędy bazy danych lub serwera (kod `INTERNAL_ERROR`).

## 7. Rozważania dotyczące wydajności
- **Indeksy:** Wykorzystanie istniejącego indeksu `cards_user_created_at_idx` dla domyślnego sortowania.
- **Wyszukiwanie:** W MVP wyszukiwanie `ILIKE` nie jest indeksowane (zgodnie z `doc/db_plan.md`). Przy dużym wzroście danych należy rozważyć indeks GIN trigram.
- **Paginacja:** Użycie `.range()` w Supabase jest wydajne dla standardowych rozmiarów stron.

## 8. Etapy wdrożenia
1. Dodanie schematu walidacji Zod dla parametrów query w `src/lib/validation/cards.ts`.
2. Utworzenie serwisu `src/lib/services/cards.service.ts` z metodą `listCards`.
3. Implementacja transformera pomocniczego (jeśli nie istnieje) do mapowania `CardEntity` na `CardDto`.
4. Utworzenie endpointu `src/pages/api/cards.ts`.
    - Wyłączenie prerenderingu: `export const prerender = false`.
    - Obsługa metody `GET` (używając formatu `GET` zgodnie z wytycznymi).
    - Integracja z `Astro.locals.supabase`.
5. Testy manualne (lub automatyczne, jeśli są wymagane) dla różnych kombinacji parametrów (page, pageSize, q, sort).
