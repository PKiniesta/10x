# Plan Testów — 10xCards (MVP)

Opracowany przez: Inżynier QA (GitHub Copilot)
Data: 2026-01-28
Projekt: 10xCards MVP

---

## 1. Wprowadzenie i cele testowania

### 1.1 Cel dokumentu
Niniejszy dokument określa strategię, zakres i metodologię testowania aplikacji 10xCards. Celem testów jest zapewnienie wysokiej jakości rozwiązania MVP, ze szczególnym uwzględnieniem stabilności procesu generowania fiszek przez AI oraz bezpieczeństwa danych użytkowników.

### 1.2 Cele testowania
- Weryfikacja poprawności wszystkich funkcji opisanych w PRD.
- Zapewnienie szczelności mechanizmów Row Level Security (RLS) w Supabase.
- Potwierdzenie skuteczności systemów limitowania zapytań AI (ochrona kosztów).
- Upewnienie się, że interfejs użytkownika jest responsywny i dostępny (a11y).

---

## 2. Zakres testów

### 2.1 Zakres włączony (In-scope)
- Autentykacja: rejestracja, logowanie, wylogowanie, reset hasła.
- Zarządzanie fiszkami (CRUD): tworzenie ręczne, edycja, usuwanie, lista, wyszukiwanie, paginacja.
- Flow AI: generowanie propozycji, walidacja inputu, proces review (akceptacja/edycja/odrzucenie).
- System limitów: blokady po przekroczeniu limitów dziennych i komunikacja resetu.
- Logowanie danych: poprawność zapisów w tabelach logów dla KPI.

### 2.2 Zakres wyłączony (Out-of-scope)
- Moduł powtórek (SM-2) - planowany w kolejnych fazach.
- Wydajność przy milionach rekordów (MVP zakłada limity dzienne).
- Testowanie natywnych aplikacji mobilnych (projekt jest webowy).

---

## 3. Typy testów do przeprowadzenia

| Typ testu | Opis | Narzędzie |
| :--- | :--- | :--- |
| **Testy Jednostkowe (Unit)** | Testowanie logiki usług (services), walidacji Zod oraz helperów. | Vitest |
| **Testy Integracyjne** | Weryfikacja interakcji z Supabase API oraz integracji z OpenRouter (mockowane). | Vitest + MSW |
| **Testy E2E (End-to-End)** | Testowanie pełnych ścieżek użytkownika w przeglądarce (np. od wklejenia tekstu do zapisu fiszki). | Playwright |
| **Testy Bezpieczeństwa** | Weryfikacja RLS i izolacji danych między użytkownikami. | Playwright / Skrypty manualne |
| **Testy UI/UX i A11y** | Sprawdzenie responsywności (Tailwind 4) oraz zgodności z ARIA (Shadcn/ui). | Axe-core / Playwright |

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1 Autentykacja i Bezpieczeństwo
- **ST-01:** Rejestracja nowego użytkownika poprawnymi danymi (sukces).
- **ST-02:** Próba logowania z błędnym hasłem (brak wycieku informacji o istnieniu konta).
- **ST-03:** Weryfikacja izolacji danych: Użytkownik A próbuje odczytać fiszkę o ID należącym do Użytkownika B (oczekiwany błąd 404/403).

### 4.2 Zarządzanie Fiszkami (Manual CRUD)
- **ST-04:** Utworzenie fiszki z frontem > 200 znaków (blokada zapisu, komunikat błędu).
- **ST-05:** Wyszukiwanie fiszki z polskimi znakami diakrytycznymi (np. "ą", "ć").
- **ST-06:** Usuwanie fiszki: sprawdzenie, czy rekord zniknął z listy głównej po potwierdzeniu.

### 4.3 Generowanie i Review AI
- **ST-07:** Generowanie z tekstem < 100 znaków (przycisk wyłączony, wyświetlony powód).
- **ST-08:** Proces akceptacji po edycji: edycja propozycji AI -> akceptacja -> weryfikacja czy w bazie zapisano wersję po zmianach.
- **ST-09:** Odświeżenie strony w trakcie review: weryfikacja czy przeglądarka wyświetla ostrzeżenie (In-memory data loss protection).

### 4.4 Limity Kostne
- **ST-10:** Przekroczenie limitu 10 generowań/dzień: przycisk "Generuj" staje się nieaktywny, pojawia się data resetu.
- **ST-11:** Osiągnięcie limitu 20 akceptacji AI: próba akceptacji 21. fiszki jest blokowana, ale odrzucanie propozycji nadal działa.

---

## 5. Środowisko testowe

- **Local:** Środowisko deweloperskie z lokalną instancją Supabase (CLI).
- **Staging/Preview:** Deploy na DigitalOcean (Gałęzie Feature/Develop) podpięty pod testowy projekt Supabase.
- **Produkcja:** Środowisko końcowe na DigitalOcean.
- **Modele AI:** Modele low-cost (np. GPT-3.5 Turbo lub Gemini Flash via OpenRouter) używane do testów integracyjnych celem oszczędności.

---

## 6. Narzędzia do testowania

- **Vitest:** Silnik testowy dla Unit & Integration.
- **Playwright:** Automatyzacja E2E i testy wizualne.
- **MSW (Mock Service Worker):** Symulowanie odpowiedzi API OpenRouter.
- **Supabase CLI:** Zarządzanie lokalną bazą danych i testowanie migracji.
- **GitHub Actions:** Automatyczne uruchamianie testów przy każdym Pull Request.

---

## 7. Harmonogram testów

1. **Faza 1 (Develop):** Pisanie testów jednostkowych równolegle z kodem produkcyjnym (TDD/BDD).
2. **Faza 2 (Feature Freeze):** Wykonanie pełnego suite'u E2E na środowisku Staging.
3. **Faza 3 (UAT):** Testy akceptacyjne przeprowadzone przez Product Ownera (weryfikacja KPI).
4. **Faza 4 (Post-launch):** Monitoring błędów (Sentry/Logi Supabase) i smoke testy po każdym deployu.

---

## 8. Kryteria akceptacji testów

- 100% krytycznych scenariuszy testowych (Priorytet 1 i 2) zakończonych sukcesem.
- Brak otwartych błędów o priorytecie "Bloker" lub "Krytyczny".
- Pokrycie kodu testami jednostkowymi (Unit Coverage) na poziomie min. 70% dla folderu `src/lib/services`.
- Poprawne generowanie rekordów logowania AI w bazie (zgodność z FR-022, FR-023).

---

## 9. Role i odpowiedzialności

- **QA Engineer:** Tworzenie scenariuszy, automatyzacja testów E2E, raportowanie błędów.
- **Frontend Developer:** Pisanie testów jednostkowych komponentów React i integracji z API.
- **Backend/Fullstack Developer:** Zapewnienie poprawności RLS i testowanie RPC/funkcji bazy danych.
- **Product Owner:** Ostateczna akceptacja funkcjonalna (UAT) i weryfikacja metryk biznesowych.

---

## 10. Procedury raportowania błędów

Błędy należy zgłaszać w GitHub Issues według poniższego szablonu:
1. **Tytuł:** Krótki i opisowy (np. "[AI] Brak blokady przycisku przy 10/10 żądań").
2. **Kroki do reprodukcji:** Lista czynności prowadzących do błędu.
3. **Oczekiwany rezultat:** Opis prawidłowego zachowania.
4. **Rzeczywisty rezultat:** Opis zaobserwowanego problemu.
5. **Środowisko:** (OS, Przeglądarka, Środowisko - np. Staging).
6. **Priorytet:** (Low, Medium, High, Blocker).
