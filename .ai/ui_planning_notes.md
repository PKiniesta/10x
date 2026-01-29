<conversation_summary>
<decisions>
1. Ekrany auth w MVP mają istnieć i obejmować minimalny zakres: logowanie, rejestracja, reset hasła oraz ustawienie nowego hasła (osobne widoki).
2. Ekranem startowym po zalogowaniu (home) jest lista fiszek.
3. Edycja fiszki ma być realizowana na ekranie szczegółów (nie modal): tryb podglądu + przycisk „Edytuj”, a edycja jako formularz z „Anuluj/Zapisz”.
4. Nawigacja po zalogowaniu: prosty top-bar z pozycjami: „Lista fiszek”, „Generuj z AI”, „Generuj manualnie”.
5. Lista fiszek: pokazuje skrót fiszki oraz akcje „Podgląd” (link do szczegółów) i „Usuń” (z potwierdzeniem). Tworzenie manualne jako osobny ekran „Nowa fiszka”.
6. Wyszukiwanie: debounce ~300–500 ms, start od 1 znaku; parametry `q/page/pageSize/sort` w URL jako źródło prawdy; zmiana `q` lub `pageSize` resetuje `page=1`.
7. Paginacja: „Następna/Poprzednia”, numer aktualnej strony oraz `total` jeśli zwraca API; selektor `pageSize` (20/30/50) w query; sort tylko domyślny (bez UI do zmiany).
8. Limity: wskaźnik limitów widoczny tylko w AI flow (ekran generowania i ekran review); pobierany przy wejściu i odświeżany po akcjach zmieniających limit (generowanie, akceptacja); bez polling w MVP.
9. Disabled dla limitów: użytkownik chce jedynie tooltip na przycisku disabled z informacją „przekroczono limit generowania ai”.
10. Review flow: osobna strona review po generowaniu; użytkownik może wrócić do generowania, ale przed opuszczeniem review ma dostać ostrzeżenie o utracie danych (bo propozycje trzymane w pamięci).
11. Przechowywanie propozycji AI: wyłącznie w pamięci w MVP (brak sessionStorage/DB).
12. Stan „brak danych review”: ekran informacyjny „Sesja review wygasła / brak danych” + CTA „Wróć do generowania”.
13. Standard obsługi błędów: centralny mapper `error.code -> {title, description, severity, retryable}`; walidacje inline; limity w kontekście jako callout/alert; 401 = redirect do /login + toast „Sesja wygasła”; 5xx = toast „Spróbuj ponownie”.
14. Ochrona tras: wszystkie trasy aplikacji poza auth są chronione; przy 401 w fetchu czyścimy stan użytkownika, redirect do `/login?redirectTo=...` i komunikat o konieczności ponownego logowania.
15. Data fetching w MVP: lekkie `fetch` + własne hooki (bez TanStack Query na start).
16. Akceptacja propozycji AI: po akceptacji oznaczyć propozycję jako zaakceptowaną (akcje disabled), pokazać toast „Zapisano fiszkę” i opcjonalny link „Zobacz fiszkę”; bez undo.
17. Responsywność: w tym MVP brak dedykowanej pracy nad responsywnością, ma działać poprawnie w HD.
18. Dostępność: „normalna” a11y — wszystkie akcje dostępne z klawiatury, widoczne focus ringi, poprawne etykiety pól, `aria-live` dla toastów/komunikatów, brak polegania wyłącznie na kolorze dla stanów.
19. UI / styling: Tailwind do stylowania; komponenty z shadcn/ui.
20. Struktura routingu (IA): `/cards` (home), `/cards/new`, `/cards/:id`, `/ai/generate`, `/ai/review`.
    </decisions>

<matched_recommendations>
1. Utrzymuj stan listy w URL (`q/page/pageSize/sort`) jako single source of truth, resetuj `page` przy zmianach filtra/rozmiaru strony.
2. Zorganizuj IA w proste, REST-owe ścieżki odpowiadające domenie: cards (list/new/detail) oraz AI (generate/review).
3. Stosuj tryb „podgląd + edycja” na ekranie szczegółów, z jasnym przepływem cancel/submit i toastem po sukcesie.
4. Zapewnij spójny standard błędów: inline walidacje dla formularzy, limity jako kontekstowy callout/alert, globalne toasty dla błędów serwera i możliwości ponowienia.
5. Zaplanuj ochronę tras i obsługę 401 w całym UI (redirect, czyszczenie stanu, `redirectTo`).
6. W AI flow pokaż czytelne limity i blokady akcji (disabled) oraz jasno sygnalizuj utratę danych review (trzymanych w pamięci) przy opuszczaniu strony.
7. Minimalne, lecz konsekwentne podejście do a11y: klawiatura, focus states, etykiety, `aria-live` i niepoleganie na kolorze.
8. Oprzyj UI o Tailwind + shadcn/ui dla spójnych komponentów (formularze, dialog potwierdzeń, toast, alert/callout).
   </matched_recommendations>

<ui_architecture_planning_summary>
a) Główne wymagania dotyczące architektury UI
- Aplikacja webowa PL, MVP skoncentrowane na: auth, CRUD fiszek, generowanie AI z obowiązkowym review per propozycja, limity dzienne (10 generowań / 20 akceptacji AI), oraz czytelna komunikacja limitów i błędów.
- Jedyny typ fiszki: front/back, z limitami długości (front 200, back 500) i walidacją w czasie rzeczywistym.
- AI input: 100–1000 znaków, licznik znaków i blokada generowania poza zakresem; wybór liczby propozycji 3–12 (domyślnie 8).
- Review: per propozycja akcje Edytuj/Akceptuj/Odrzuć, brak bulk actions, odrzucone nie są utrwalane.

b) Kluczowe widoki, ekrany i przepływy użytkownika
- Public (auth):
    - `/login`, `/register`, `/reset-password`, `/new-password`.
- App (chronione):
    - `/cards` (home): lista fiszek z wyszukiwaniem, paginacją i akcjami „Podgląd” + „Usuń”.
    - `/cards/new`: formularz tworzenia manualnej fiszki (front/back + liczniki + inline walidacje).
    - `/cards/:id`: szczegóły fiszki (podgląd) + przejście do trybu edycji; edycja z cancel/submit; toast po zapisie.
    - `/ai/generate`: formularz generowania (input tekstu + licznik, wybór liczby fiszek, przycisk generuj) oraz stały wskaźnik limitów.
    - `/ai/review`: lista propozycji do review; możliwość edycji propozycji przed akceptacją z limitami 200/500; po akceptacji status „zaakceptowana” + toast + opcjonalny link do nowej fiszki; odrzucenie pozostaje możliwe nawet przy limicie akceptacji.
- Nawigacja:
    - Prosty top-bar: „Lista fiszek”, „Generuj z AI”, „Generuj manualnie”.

c) Strategia integracji z API i zarządzania stanem
- Dane kart:
    - Lista `/api/cards` z query: `q`, `page`, `pageSize`, `sort` (domyślnie createdAt desc).
    - Szczegóły `/api/cards/{cardId}` dla ekranu `/cards/:id`.
    - Mutacje: create (manual), update, delete; po mutacji odświeżenie/invalidacja widoku listy (w oparciu o stan z URL).
- AI flow:
    - Generowanie przez endpoint AI (wg planu API), po sukcesie przejście na `/ai/review`.
    - Propozycje review trzymane wyłącznie w pamięci (in-memory). Konsekwencje:
        - Refresh / deep link → „Sesja review wygasła / brak danych” + CTA.
        - Przed opuszczeniem review → ostrzeżenie o utracie danych.
    - Limity pobierane przy wejściu na AI strony i odświeżane po generowaniu/akceptacji; brak pollingu.
- Data fetching:
    - MVP: lekkie `fetch` + własne hooki (bez dodatkowej biblioteki query/cache).
- Błędy i komunikaty:
    - Centralny mapper kodów błędów z API do komunikatów i strategii retry.
    - Inline walidacje dla pól, toasty dla błędów globalnych i sukcesów („Zapisano”, „Zapisano fiszkę”).
    - Dla 401: redirect do login z `redirectTo`.

d) Kwestie dotyczące responsywności, dostępności i bezpieczeństwa
- Responsywność:
    - W MVP brak dedykowanego zakresu responsywnego; UI ma działać poprawnie w rozdzielczości HD.
- Dostępność:
    - Minimalna, ale świadoma: pełna obsługa klawiatury, widoczne focus ringi, etykiety pól, `aria-live` dla toastów/statusów, stany (accepted/rejected/disabled) nie tylko kolorem.
    - Uwaga: decyzja o tooltipie jako jedynym wyjaśnieniu disabled jest ryzykowna a11y (szczególnie dla disabled elementów i mobile), ale została wskazana jako preferencja użytkownika na teraz.
- Bezpieczeństwo:
    - Chronione trasy aplikacji poza auth.
    - Spójna obsługa 401 w fetchu (czyszczenie stanu, redirect, komunikat).
    - Izolacja danych per user w założeniach (RLS/serwerowe endpointy), co wpływa na UI (brak dostępu bez sesji).

e) Wszelkie nierozwiązane kwestie / obszary do doprecyzowania przed szczegółową architekturą UI
- Wymagają doprecyzowania techniczne detale ekranów auth (konkretny UX resetu/ustawienia hasła w Supabase + routing callback).
- Wymagają spisania finalne mapowania `error.code` (zgodne z implementacją endpointów) oraz lista kodów, których UI ma się spodziewać.
- Wymaga ustalenia zachowanie sort parametru w URL (zostaje domyślny, ale czy w ogóle trzymamy `sort` w query, czy pomijamy i traktujemy jako stały?).
  </ui_architecture_planning_summary>

<unresolved_issues>
1. Tooltip jako jedyne wyjaśnienie dla przycisku disabled (limit generowania AI) może być problematyczne dla dostępności i w praktyce bywa niewyświetlane dla disabled elementów; jeśli zostaje, warto doprecyzować technicznie jak będzie realizowany (wrapper + aria-describedby + fallback tekst).
2. Brak responsywności w MVP: nie wskazano minimalnego zachowania na mniejszych ekranach (choć to może być akceptowane), ale warto potwierdzić „co najmniej nie może się rozsypać” vs „wspieramy tylko desktop”.
3. Brak decyzji, czy po utworzeniu manualnej fiszki przekierowujemy na `/cards` czy na `/cards/:id` (wpływa na flow i cache/odświeżanie). ODPOWIEDź ->  po utworzeniu manualny szyszki przekierowujemy na strone /cards
4. Brak doprecyzowania, czy UI ma pokazywać `total` zawsze (gdy API zwróci) czy degradować się do „są kolejne strony” gdy `total` niedostępny. ODPOWIEDź ->  UI ma pokazywać total zawsze gdy API zwróci tę wartość.
5. Brak doprecyzowanych treści komunikatów PL (copy) dla kluczowych stanów limitów, błędów i utraty sesji review. -> ODPOWIEDź -> Treści komunikatów PL dla kluczowych stanów limitów, błędów i utraty sesji review mają być wklejone w trakcie przez AI, bądź zostawione po angielsku.
   </unresolved_issues>
   </conversation_summary>
