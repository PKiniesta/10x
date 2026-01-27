<conversation_summary>
<decisions>
1. MVP bez talii i tagów — fiszki istnieją jako pojedyncze rekordy (front/back).
2. Dopuszczamy dodanie „pustych” opcjonalnych pól tekstowych w tabeli `cards` na przyszłą minimalną kategoryzację, ale w MVP nie będą używane.
3. Fiszki mogą powstawać manualnie lub z AI; każda fiszka ma UUID.
4. Wszystkie główne tabele mają UUID generowane w bazie (default w DB), nie w aplikacji.
5. W `cards` dodajemy pole `origin` (manual/ai) oraz opcjonalne `ai_generation_id` (UUID, nullable) i wymuszamy spójność constraintem:
    - `origin='manual' => ai_generation_id IS NULL`
    - `origin='ai' => ai_generation_id IS NOT NULL`
6. Treść propozycji AI nie jest zapisywana w DB (review działa tylko w ramach bieżącej sesji; odświeżenie = utrata danych propozycji).
7. Limity dzienne są egzekwowane na poziomie bazy danych (nie tylko w UI).
8. Wszystkie znaczniki czasu zapisujemy jako `timestamptz`, a limity liczymy w UTC.
9. Log generowania ma obejmować zarówno sukces, jak i porażkę — oba liczą się do limitu 10 żądań dziennie.
10. Wyszukiwanie w MVP ma być możliwie proste: `ILIKE` (bez optymalizacji wydajności na tym etapie).
11. Usuwanie fiszek: hard delete (twarde kasowanie) dla `cards`.
12. Logi AI mają być historyczne i niekasowalne (nie usuwamy ich przy usuwaniu fiszek).
13. Akceptacja propozycji AI ma działać jako pojedyncza transakcja w DB.
14. Użytkownik nie powinien mieć bezpośredniego INSERT do tabel logów AI; logi i limity mają być obsługiwane przez bezpieczne RPC / service role zgodnie z RLS.
    </decisions>

<matched_recommendations>
1. Minimalna „kategoryzacja w przyszłości” bez nowych encji: dodać nullable pola tekstowe w `cards` (np. `source_title`, `source_ref`) zamiast tabel typu decks/tags.
2. Rozróżnienie pochodzenia fiszki: `cards.origin` + CHECK (`manual|ai`) oraz `cards.ai_generation_id` (nullable) dla KPI i debugowania.
3. Generowanie UUID w DB: `gen_random_uuid()` jako default PK dla `cards` i tabel logów (spójność, prostsze inserty).
4. Brak przechowywania treści propozycji: review jest nietrwałe; DB przechowuje tylko metadane do KPI.
5. Egzekwowanie limitów w DB: limity dzienne (10 requestów, 20 akceptów) jako reguły po stronie DB, liczone w UTC.
6. Log generowania jako „zawsze zapisuj” (success i failure): każdy request tworzy rekord do KPI/limitów.
7. Hard delete dla `cards` oraz zachowanie logów: logi historyczne, a powiązanie `created_card_id` w logu najlepiej utrzymać przy usuwaniu fiszki (np. przez `ON DELETE SET NULL` albo brak twardego FK).
8. Akceptacja jako jedna transakcja DB: walidacje długości 200/500, sprawdzenie limitu 20/dzień, zapis `cards` i zapis logu accepted=true w jednym atomowym wywołaniu.
9. RLS + RPC: zablokować możliwość fałszowania limitów i KPI poprzez bezpośrednie inserty do logów; wykonywać operacje przez RPC (SECURITY DEFINER) lub service role.
10. Wyszukiwanie: w MVP użyć `ILIKE` (a ewentualną optymalizację jak trigram/FTS odłożyć na później).
    </matched_recommendations>

<database_planning_summary>
### a) Główne wymagania dotyczące schematu bazy danych
- Dane per-użytkownik (izolacja danych): użytkownik widzi i modyfikuje wyłącznie swoje fiszki oraz swoje logi (FR-004, US-005).
- Format fiszki: wyłącznie `front`/`back` (tekst) z limitami długości: front ≤ 200, back ≤ 500 (FR-005–FR-006).
- Lista fiszek sortowana po `created_at DESC` oraz stronicowanie 20–50 (FR-009).
- Wyszukiwanie po `front/back` (FR-010) — w MVP realizowane prosto (ILIKE).
- AI:
    - generowanie z wejścia 100–1000 znaków, parametr liczby fiszek 3–12 (domyślnie 8),
    - review obowiązkowy, akceptacja/odrzucenie per propozycja,
    - brak przechowywania treści odrzuconych propozycji w DB (FR-019),
    - limity kosztowe: 10 requestów/dzień i 20 akceptów/dzień per user w UTC (FR-020),
    - logi w DB muszą umożliwiać wyliczenie KPI 1 i KPI 2 (FR-022–FR-024).
- Wszystkie ID jako UUID generowane w DB. Wszystkie timestampy `timestamptz`. Limity liczone w UTC.
- Usuwanie fiszek twarde, ale logi AI mają pozostać historyczne.

### b) Kluczowe encje i ich relacje (proponowany minimalny model)
1) `cards`
- PK: `id uuid`
- `user_id uuid` (powiązanie z auth.users w Supabase)
- `front text`, `back text` + CHECK długości 200/500
- `origin text not null` (manual/ai)
- `ai_generation_id uuid null` (ustawiane tylko dla AI) + CHECK spójności z `origin`
- `source_title text null`, `source_ref text null` (puste w MVP, na przyszłość)
- `created_at timestamptz`, `updated_at timestamptz` (rekomendowane)

Relacja: `cards.user_id -> auth.users.id` (właściciel)
Relacja opcjonalna: `cards.ai_generation_id -> ai_generation_requests.generation_id` (warto rozważyć FK lub luźne powiązanie).

2) `ai_generation_requests` (log żądań generowania; agregaty na żądanie)
- PK: może być osobne `id uuid`, ale kluczowy jest `generation_id uuid` (unikalny identyfikator sesji generowania)
- `user_id uuid`
- `created_at timestamptz`
- `input_length int`
- `requested_cards_count int`
- `generated_cards_count int`
- `status text` (success/failure)
- opcjonalnie: `provider`, `model`
- opcjonalnie: `error_code`, `error_message` (dla failure)
  Ważne: każdy request (sukces lub porażka) tworzy rekord i liczy się do dziennego limitu 10.

Relacja: `ai_generation_requests.user_id -> auth.users.id`

3) `ai_proposal_logs` (log akceptacji/odrzucenia per propozycja)
- PK: `id uuid`
- `user_id uuid`
- `generation_id uuid` (powiązanie z `ai_generation_requests.generation_id`)
- `proposal_index int` (0..n-1)
- `accepted boolean`
- `created_at timestamptz`
- `created_card_id uuid null` (ustawiane tylko gdy accepted=true)
  Wymaganie: log musi istnieć per propozycja, żeby KPI 1 miało poprawny mianownik (liczba wygenerowanych propozycji).

Relacje:
- `ai_proposal_logs.user_id -> auth.users.id`
- `ai_proposal_logs.generation_id -> ai_generation_requests.generation_id` (FK rekomendowany)
- `ai_proposal_logs.created_card_id -> cards.id` (jeśli FK, to preferowane `ON DELETE SET NULL`, bo `cards` są hard delete, a log ma przetrwać).

### c) Ważne kwestie bezpieczeństwa i skalowalności
Bezpieczeństwo / RLS (Supabase + Postgres):
- `cards`: RLS wymuszające dostęp wyłącznie do rekordów `user_id = auth.uid()` dla SELECT/INSERT/UPDATE/DELETE.
- Logi AI: użytkownik ma dostęp tylko do swoich logów (SELECT).
- Żeby użytkownik nie mógł fałszować limitów/KPI, bezpośrednie inserty do tabel logów powinny być ograniczone (preferowany model: operacje przez RPC/SECURITY DEFINER lub service role).
- Limity egzekwowane w DB: kluczowe, żeby uniknąć omijania limitów przez równoległe requesty lub manipulacje po stronie klienta.

Spójność i integralność:
- CHECK constraints dla długości front/back.
- CHECK dla spójności `origin` i `ai_generation_id`.
- Unikalność (rekomendowane): `(user_id, generation_id)` w `ai_generation_requests`, oraz `(user_id, generation_id, proposal_index)` w `ai_proposal_logs` (zapobiega duplikatom).
- Akceptacja jako jedna transakcja DB (RPC): walidacja + limit + insert do `cards` + insert do `ai_proposal_logs` atomowo.

Wydajność / skalowalność:
- MVP: wyszukiwanie `ILIKE` bez wymogu optymalizacji.
- Minimalne indeksy rekomendowane już teraz (pod listę i logi), bo będą często używane:
    - `cards(user_id, created_at desc)` (lista + pagination)
    - `ai_generation_requests(user_id, created_at desc)` (limity + historia)
    - `ai_proposal_logs(user_id, created_at desc)` oraz/lub `(user_id, generation_id, proposal_index)` (spójność + KPI)
- Partycjonowanie nie jest potrzebne w MVP; można wrócić do niego, jeśli logi urosną.

### d) Obszary wymagające dalszego wyjaśnienia (na następnym etapie)
- Dokładny zestaw „pustych” pól tekstowych w `cards` (nazwy, limity długości, czy potrzebny `updated_at`).
- Kontrakt RPC i ich lista:
    - czy rozdzielamy `reject_ai_proposal(...)` od `accept_ai_proposal(...)`,
    - czy tworzymy osobne RPC do „rezerwacji” generation request (limit 10) oraz do finalizacji statusu.
- Polityka retencji/prywatności dla logów błędów (`error_message`) — PRD sygnalizuje użytkowników nieletnich; warto ustalić minimalny poziom szczegółowości.
- Dokładne reguły FK vs brak FK w logach (zwłaszcza `created_card_id`) przy hard delete fiszek — decyzja „logi mają przetrwać” jest podjęta, ale wybór mechaniki (ON DELETE SET NULL vs luźne powiązanie) do doprecyzowania.
  </database_planning_summary>

<unresolved_issues>
1. Jakie dokładnie „puste” pola tekstowe dodajemy w `cards` (konkretne nazwy i limity długości), oraz czy potrzebujemy `updated_at`.
2. Czy `ai_generation_requests` ma mieć osobne `id` jako PK, czy wystarczy `generation_id` jako PK/unique (obie opcje są poprawne, ale wpływają na FK i ergonomię).
3. Czy `ai_proposal_logs` zawsze zapisuje rekord dla każdej propozycji (accepted=true/false), czy dopuszczamy brak logu dla części propozycji w razie awarii po stronie klienta (wpływa na KPI 1).
4. Jak szczegółowe mogą być `error_code/error_message` w DB (retencja/prywatność) i czy przewidujemy okresowe czyszczenie logów mimo „historyczności”.
5. Dokładna implementacja egzekwowania limitów w DB (RPC vs trigger) i sposób zabezpieczenia przed race conditions przy wielu równoległych kliknięciach/wywołaniach.
   </unresolved_issues>
   </conversation_summary>
