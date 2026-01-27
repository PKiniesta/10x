# API Endpoint Implementation Plan: Reject an AI proposal

## 1. Przegląd punktu końcowego
Endpoint umożliwia odrzucenie propozycji karty wygenerowanej przez AI. Operacja ta jest logowana w tabeli `ai_proposal_logs` z flagą `accepted=false`. Odrzucenie propozycji nie powoduje utworzenia nowej karty w systemie. System weryfikuje, czy sesja generowania należy do zalogowanego użytkownika oraz sprawdza poprawność tokenu przeglądu (`reviewToken`).

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/ai/generations/{generationId}/proposals/{proposalIndex}/reject`
- Parametry:
    - `generationId` (ścieżka): UUID sesji generowania AI (wymagane).
    - `proposalIndex` (ścieżka): Indeks propozycji (liczba całkowita >= 0, wymagane).
- Request Body (JSON):
    ```json
    {
      "reviewToken": "string"
    }
    ```

## 3. Wykorzystywane typy

### Zod Schemas (`src/lib/validation/ai-generation.ts`)
- `rejectAiProposalCommandSchema`: walidacja body (`reviewToken`).
- `rejectAiProposalParamsSchema`: walidacja parametrów ścieżki (`generationId`, `proposalIndex`).

### DTOs (`src/types.ts`)
- `RejectAiProposalCommand`: model danych wejściowych.
- `RejectAiProposalResponseDto`: struktura odpowiedzi sukcesu.
- `AiProposalLogDto`: dane szczegółowe o logu propozycji.

## 3. Szczegóły odpowiedzi

### Sukces (200 OK)
```json
{
  "ok": true,
  "log": {
    "generationId": "uuid",
    "proposalIndex": 0,
    "accepted": false,
    "createdCardId": null,
    "createdAt": "2026-01-27T12:00:00.000Z"
  }
}
```

### Błędy
- `400 Bad Request` (`VALIDATION_ERROR`): Niepoprawne parametry lub brak tokenu.
- `401 Unauthorized` (`AUTH_REQUIRED`): Brak zalogowanego użytkownika.
- `404 Not Found` (`GENERATION_NOT_FOUND`): Sesja generowania nie istnieje lub nie należy do użytkownika.
- `409 Conflict` (`PROPOSAL_ALREADY_DECIDED`): Decyzja dla tej propozycji została już podjęta i nie można jej zmienić (opcjonalnie, zależnie od ostatecznej decyzji o idempotentości).

## 4. Przepływ danych
1. **Middleware**: Sprawdzenie autoryzacji (dostęp do sesji Supabase).
2. **Endpoint Handler**:
    - Ekstrakcja i walidacja parametrów ścieżki oraz body przy użyciu Zod.
    - Pobranie `userId` z `context.locals`.
3. **Service Layer (`ai-generation.service.ts`)**:
    - Weryfikacja właściciela sesji `generationId` w tabeli `ai_generation_requests`.
    - Sprawdzenie poprawności `reviewToken` (porównanie z oczekiwanym dla danej sesji).
    - Sprawdzenie w `ai_proposal_logs`, czy decyzja została już podjęta. Jeśli tak, zwrócenie błędu `409 Conflict`.
    - Wstawienie (INSERT) wpisu do `ai_proposal_logs` z `accepted=false` i `created_card_id=null` przy użyciu `supabaseAdmin` (ze względu na restrykcje RLS).
4. **Endpoint Handler**: Zwrócenie wyniku operacji lub sformatowanego błędu.

## 5. Względy bezpieczeństwa
- **Autoryzacja**: Każde żądanie musi zawierać ważną sesję użytkownika.
- **Ownership**: Serwer musi sprawdzić, czy `generation_id` jest powiązany z `userId` wykonującym żądanie.
- **Review Token**: Token `reviewToken` służy jako dodatkowe zabezpieczenie przed nieautoryzowanymi żądaniami do endpointów modyfikujących status propozycji poza interfejsem przeglądu.
- **RLS**: Tabele logów AI nie pozwalają na bezpośredni zapis z poziomu klienta, dlatego operacja musi być wykonana przez `supabaseAdmin` na serwerze.

## 6. Obsługa błędów
- Zastosowanie standardowego formatu odpowiedzi błędu określonego w `api_plan.md`.
- Przechwytywanie wyjątków bazy danych (np. naruszenie klucza unikalnego `ai_prop_logs_user_generation_proposal_unique`).
- Walidacja danych wejściowych Zod zwracająca czytelne komunikaty o błędach.

## 7. Rozważania dotyczące wydajności
- **Idempotentność**: Upsert zamiast Insert może poprawić odporność na powtarzające się żądania, jednak w PRD sugerowane jest blokowanie zmiany raz podjętej decyzji.
- **DB Indexing**: Wykorzystanie istniejącego indeksu unikalnego na `(user_id, generation_id, proposal_index)` zapewnia szybkie wyszukiwanie i spójność.

## 8. Etapy wdrożenia
1. **Typy**: Dodać `RejectAiProposalCommand` oraz `RejectAiProposalResponseDto` do `src/types.ts`.
2. **Walidacja**: Dodać `rejectAiProposalCommandSchema` oraz `rejectAiProposalParamsSchema` do `src/lib/validation/ai-generation.ts`.
3. **Logika biznesowa**:
    - W `src/lib/services/ai-generation.service.ts` dodać metodę `rejectAiProposal`.
    - Metoda powinna przyjmować `supabaseAdmin`, `userId`, `generationId`, `proposalIndex` oraz `reviewToken`.
    - Zaimplementować sprawdzenie istnienia sesji i poprawności tokenu.
    - Zaimplementować zapis do `ai_proposal_logs`.
4. **Endpoint**:
    - Utworzyć plik `src/pages/api/ai/generations/[generationId]/proposals/[proposalIndex]/reject.ts`.
    - Zaimplementować obsługę metody `POST`.
    - Skonfigurować `export const prerender = false`.
5. **Testy**: Zweryfikować poprawność działania (np. próba odrzucenia nieistniejącej propozycji, próba odrzucenia propozycji innego użytkownika).
