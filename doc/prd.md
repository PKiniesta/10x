# Dokument wymagań produktu (PRD) - 10xCards

## 1. Przegląd produktu

1.1 Cel produktu
10xCards to webowa aplikacja (MVP) w języku polskim, przeznaczona dla uczniów przed studiami (szkoła podstawowa i średnia, w tym technikum), która przyspiesza tworzenie fiszek edukacyjnych oraz ułatwia późniejsze wdrożenie nauki metodą spaced repetition.

1.2 Kluczowa propozycja wartości
- Użytkownik wkleja tekst po polsku, a AI proponuje fiszki w formacie pytanie/odpowiedź (front/back).
- Użytkownik zatwierdza pojedyncze propozycje (z możliwością edycji), dzięki czemu baza fiszek rośnie szybko przy zachowaniu jakości.
- MVP koncentruje się na szybkim tworzeniu i zarządzaniu fiszkami; integracja z powtórkami (SM-2) zostanie dodana w kolejnej fazie.

1.3 Zakres MVP (high-level)
- Konta użytkowników (email/hasło) i reset hasła.
- Fiszki: tworzenie manualne, przeglądanie, wyszukiwanie, edycja, usuwanie.
- AI: generowanie propozycji fiszek z wklejanego tekstu (100–1000 znaków), z parametrem liczby fiszek.
- Review flow: akceptacja/odrzucenie per fiszka, z opcjonalną edycją przed akceptacją.
- Limity kosztowe: 10 żądań generowania/dzień i 20 zaakceptowanych fiszek AI/dzień na użytkownika.
- Logowanie zdarzeń AI do dedykowanej tabeli w bazie danych, aby liczyć KPI.

1.4 Założenia produktowe (do przyjęcia na MVP)
Poniższe elementy nie były wprost ustalone w podsumowaniu, ale są konieczne do zamknięcia PRD w postaci testowalnych wymagań. Przyjęto konserwatywne wartości, łatwe do zmiany w konfiguracji.
- Liczba fiszek do wygenerowania: domyślnie 8, zakres 3–12.
- Zachowanie limitów:
  - Po osiągnięciu limitu 10 żądań/dzień: blokada uruchomienia generowania do następnego dnia.
  - Po osiągnięciu limitu 20 zaakceptowanych fiszek AI/dzień: generowanie nadal możliwe, ale przyciski akceptacji są zablokowane (z czytelnym komunikatem).


## 2. Problem użytkownika

2.1 Obserwowany problem
Manualne tworzenie wysokiej jakości fiszek jest czasochłonne. W praktyce powoduje to, że:
- uczniowie rezygnują z tworzenia fiszek,
- uczniowie odkładają wdrożenie spaced repetition, mimo że jest to skuteczna metoda nauki,
- nawet jeśli zaczynają, utrzymanie regularności powtórek jest trudne bez prostego procesu.

2.2 Kogo dotyczy
- Uczniowie uczący się materiału szkolnego (po polsku), którzy mają tekstowe źródła: notatki, fragmenty podręcznika, streszczenia, skrypty.
- Użytkownicy, którzy chcą prostego narzędzia webowego i nie potrzebują rozbudowanych funkcji typu talie, tagi, współdzielenie.

2.3 Wymagania wynikające z problemu
- Szybkie tworzenie fiszek bez utraty kontroli nad jakością (review + edycja).
- Niskie tarcie wejścia: jeden format fiszki (front/back), jeden prosty formularz manualny.
- Solidna baza fiszek w koncie użytkownika, która może być później użyta w module powtórek.
- Ochrona kosztów: limity dzienne i jasna komunikacja o pozostałym limicie.


## 3. Wymagania funkcjonalne
### TEST
3.1 Konta użytkowników i dostęp
FR-001 Rejestracja
- System umożliwia założenie konta przy użyciu email i hasła.
- Konto jest wymagane, aby przechowywać fiszki.

FR-002 Logowanie i sesja
- System umożliwia logowanie email/hasło.
- System utrzymuje sesję użytkownika (mechanizm nie jest narzucony w MVP), umożliwiając dostęp do fiszek użytkownika.

FR-003 Reset hasła
- System umożliwia zainicjowanie resetu hasła na email.
- System umożliwia ustawienie nowego hasła po przejściu procesu resetu.

FR-004 Autoryzacja danych
- Użytkownik ma dostęp wyłącznie do swoich fiszek oraz logów generowania.

3.2 Model danych fiszek
FR-005 Format fiszki
- Jedyny typ fiszki w MVP to tekstowa fiszka front/back.
- „Termin + definicja” jest realizowane jako przypadek fiszki front/back, bez osobnych typów.

FR-006 Ograniczenia długości (manual)
- Front: maksymalnie 200 znaków.
- Back: maksymalnie 500 znaków.
- Walidacja wykonywana natychmiast podczas wpisywania oraz przy zapisie.

3.3 Manualne tworzenie fiszek
FR-007 Formularz „Nowa fiszka”
- Jeden prosty formularz: pola front i back.
- Widoczne liczniki znaków (front/200, back/500).
- Błędy walidacji są czytelne i blokują zapis.

FR-008 Zapis manualnej fiszki
- Zapisana fiszka jest dostępna na liście fiszek.

3.4 Przeglądanie, wyszukiwanie, edycja i usuwanie
FR-009 Lista fiszek
- Lista jest posortowana malejąco po created_at (najnowsze na górze).
- Stronicowanie: 20–50 elementów na stronę (wartość konfigurowalna w tym zakresie).

FR-010 Wyszukiwanie pełnotekstowe
- Użytkownik może wyszukiwać po treści front/back.
- Wyniki respektują sortowanie i stronicowanie.

FR-011 Edycja fiszki
- Użytkownik może edytować front/back dla istniejącej fiszki.
- Obowiązują te same limity długości co przy tworzeniu manualnym.
- Edycja może być realizowana w modalu lub osobnym widoku (wybór implementacyjny).

FR-012 Usuwanie fiszki
- Użytkownik może usunąć fiszkę.

3.5 Generowanie fiszek przez AI
FR-013 Wejście generowania
- Użytkownik wkleja tekst (plain text).
- Długość wejścia: 100–1000 znaków.
- System wyświetla licznik znaków i walidację (poniżej 100 i powyżej 1000 generowanie jest zablokowane).

FR-014 Parametr liczby fiszek
- Użytkownik wybiera „Ile fiszek wygenerować”.
- Zakres i domyślna wartość: domyślnie 8, zakres 3–12.

FR-015 Uruchomienie generowania
- Użytkownik uruchamia generowanie.
- System uwzględnia limity dzienne (FR-020).
- System pokazuje stan ładowania i czytelny błąd w przypadku niepowodzenia.

FR-016 Format propozycji
- AI zwraca propozycje fiszek front/back w języku polskim.
- Propozycje są wyświetlane jako oddzielne elementy do review.

3.6 Review i akceptacja propozycji AI
FR-017 Krok review jest obowiązkowy
- Po generowaniu użytkownik trafia na ekran review.
- Nie ma opcji automatycznej akceptacji wszystkich.

FR-018 Akceptacja/odrzucenie per fiszka
- Dla każdej propozycji użytkownik może:
  - zaakceptować (zapis fiszki),
  - edytować i zaakceptować (zapis fiszki),
  - odrzucić (brak zapisu fiszki).
- Akceptacja jest zawsze pojedyncza (brak bulk actions).

FR-019 Brak utrwalania odrzuconych propozycji
- Odrzucone propozycje nie są zapisywane jako fiszki.
- System nie przechowuje treści odrzuconych propozycji w bazie (MVP), poza ewentualnymi metadanymi potrzebnymi do KPI (FR-022).

3.7 Limity kosztowe i komunikacja
FR-020 Limity dzienne
- 10 żądań generowania/dzień/użytkownika.
- 20 zaakceptowanych fiszek AI/dzień/użytkownika.
- Limity resetują się „co dzień” (zależnie od strefy czasowej systemu; w MVP przyjąć UTC i komunikować użytkownikowi datę/godzinę resetu).

FR-021 Komunikaty i licznik limitu
- UI pokazuje pozostały limit żądań generowania na dziś.
- UI pokazuje pozostały limit akceptacji fiszek AI na dziś.
- Po osiągnięciu limitu:
  - generowanie jest zablokowane (gdy limit żądań),
  - akceptacja jest zablokowana (gdy limit akceptacji),
  - użytkownik widzi jasny komunikat o powodzie i czasie resetu.

3.8 Logging i metryki (w bazie)
FR-022 Log generowania (agregaty na żądanie)
- System zapisuje rekord dla każdego żądania generowania (AI generation request), zawierający co najmniej:
  - user_id
  - generation_id
  - created_at
  - input_length
  - requested_cards_count
  - generated_cards_count
  - status (success/failure)
  - model/provider (opcjonalnie, ale rekomendowane)
  - error_code/error_message (dla failure)

FR-023 Log akceptacji per propozycja
- System zapisuje rekord dla każdej propozycji wygenerowanej w ramach generation_id, zawierający co najmniej:
  - user_id
  - generation_id
  - proposal_index (0..n-1) lub proposal_id
  - accepted (boolean)
  - created_at
- Dla zaakceptowanych propozycji system dodatkowo zapisuje:
  - created_card_id (id utworzonej fiszki)
- W MVP akceptacja „po edycji” nie jest rozróżniana od akceptacji bez edycji.

FR-024 Wyliczanie KPI z logów
- System umożliwia wyliczenie KPI 1 i KPI 2 wyłącznie z tabel logów oraz danych o utworzonych fiszkach.


## 4. Granice produktu

4.1 W zakresie MVP
- Web aplikacja w języku polskim.
- Jeden format fiszki: front/back (tekst).
- Manualne tworzenie i podstawowe CRUD.
- AI generowanie z wklejanego tekstu, wraz z review per fiszka.
- Dzienne limity generowania i akceptacji.
- Logowanie zdarzeń AI do bazy dla KPI.

4.2 Poza zakresem MVP
- Moduł powtórek spaced repetition (SM-2), w tym ekran „Powtórki”, kolejka fiszek oraz ocenianie (np. 4 przyciski) i aktualizacja harmonogramu.
- Zaawansowane algorytmy SRS (Anki/SuperMemo-grade), rozbudowana parametryzacja, synchronizacja między urządzeniami.
- Import formatów innych niż plain text (PDF, DOCX itp.).
- Współdzielenie talii/zestawów fiszek między użytkownikami.
- Integracje z innymi platformami edukacyjnymi.
- Aplikacje mobilne (na start tylko web).
- Kategorie, tagi, talie (decki), filtry, hierarchie materiału.

4.3 Ograniczenia i ryzyka (do świadomej akceptacji)
- Rejected proposals nie są utrwalane, co ogranicza możliwości analityczne (np. brak pełnego porównania przyczyn odrzuceń).
- Użytkownicy mogą być nieletni: wymagane minimum prywatności (zgoda, polityka retencji) nie jest zaprojektowane w tym PRD i powinno być doprecyzowane przed publikacją.
- Full-text search: wybór implementacji zależy od bazy danych i nie jest narzucony (należy zapewnić wyszukiwanie po front/back).


## 5. Historyjki użytkowników

Uwaga: wszystkie historyjki są zaprojektowane jako testowalne. Tam gdzie to konieczne, zawierają warianty alternatywne i skrajne.

5.1 Uwierzytelnianie i bezpieczeństwo dostępu

- ID: US-001
  Tytuł: Rejestracja konta
  Opis: Jako użytkownik chcę założyć konto za pomocą email i hasła, aby moje fiszki były przechowywane i dostępne po zalogowaniu.
  Kryteria akceptacji:
  1. Formularz rejestracji wymaga email i hasła.
  2. Email jest walidowany (format) i musi być unikalny.
  3. Hasło jest wymagane i ma minimalną długość (do ustalenia implementacyjnie, nie mniej niż 8 znaków).
  4. Po poprawnej rejestracji użytkownik zostaje zalogowany lub przekierowany do logowania (spójnie z wybraną implementacją).

- ID: US-002
  Tytuł: Logowanie
  Opis: Jako użytkownik chcę zalogować się email i hasłem, aby uzyskać dostęp do swoich fiszek.
  Kryteria akceptacji:
  1. Przy poprawnych danych użytkownik uzyskuje dostęp do aplikacji.
  2. Przy błędnych danych system pokazuje komunikat o błędzie bez ujawniania, czy email istnieje.

- ID: US-003
  Tytuł: Wylogowanie
  Opis: Jako użytkownik chcę się wylogować, aby zakończyć sesję na współdzielonym urządzeniu.
  Kryteria akceptacji:
  1. Użytkownik może wylogować się z dowolnego miejsca w aplikacji.
  2. Po wylogowaniu zasoby wymagające logowania nie są dostępne.

- ID: US-004
  Tytuł: Reset hasła
  Opis: Jako użytkownik chcę zresetować hasło, gdy go nie pamiętam, aby odzyskać dostęp do konta.
  Kryteria akceptacji:
  1. Użytkownik może wprowadzić email i zainicjować reset hasła.
  2. System wysyła instrukcję resetu (lub w środowisku deweloperskim symuluje wysyłkę).
  3. Proces resetu pozwala ustawić nowe hasło i zalogować się.
  4. Komunikaty nie ujawniają, czy email istnieje.

- ID: US-005
  Tytuł: Izolacja danych pomiędzy kontami
  Opis: Jako użytkownik chcę mieć pewność, że inni użytkownicy nie zobaczą moich fiszek, aby moje dane były prywatne.
  Kryteria akceptacji:
  1. Niezalogowany użytkownik nie ma dostępu do listy fiszek.
  2. Zalogowany użytkownik widzi tylko fiszki przypisane do jego user_id.
  3. Próba odczytu/edycji/usunięcia fiszki innego user_id kończy się błędem autoryzacji.

5.2 Manualne fiszki (CRUD)

- ID: US-006
  Tytuł: Utworzenie fiszki manualnie
  Opis: Jako użytkownik chcę utworzyć fiszkę wpisując front i back, aby szybko dodać materiał bez użycia AI.
  Kryteria akceptacji:
  1. Formularz pokazuje liczniki znaków dla front (200) i back (500).
  2. System blokuje zapis, jeśli front > 200 lub back > 500.
  3. Po udanym zapisie fiszka jest widoczna na liście fiszek.

- ID: US-007
  Tytuł: Walidacja manualnej fiszki w czasie rzeczywistym
  Opis: Jako użytkownik chcę widzieć od razu błędy długości, abym mógł szybko poprawić treść przed zapisem.
  Kryteria akceptacji:
  1. Po przekroczeniu limitu znaków pole jest oznaczone błędem.
  2. Komunikat zawiera informację o limicie i aktualnej długości.
  3. Po powrocie do zakresu limitu błąd znika.

- ID: US-008
  Tytuł: Lista fiszek z sortowaniem
  Opis: Jako użytkownik chcę widzieć listę moich fiszek od najnowszych, abym łatwo odnajdywał ostatnio dodane.
  Kryteria akceptacji:
  1. Domyślne sortowanie to created_at malejąco.
  2. Dodanie nowej fiszki powoduje jej pojawienie się na górze listy.

- ID: US-009
  Tytuł: Stronicowanie listy fiszek
  Opis: Jako użytkownik chcę przeglądać fiszki po stronach, aby lista była szybka i czytelna.
  Kryteria akceptacji:
  1. Użytkownik widzi maksymalnie N fiszek na stronie (N w zakresie 20–50).
  2. Użytkownik może przejść na następną i poprzednią stronę.
  3. Widok informuje o numerze strony i liczbie wyników (lub co najmniej o tym, że są kolejne strony).

- ID: US-010
  Tytuł: Wyszukiwanie po treści fiszek
  Opis: Jako użytkownik chcę wyszukać fiszki po słowach kluczowych, aby szybko znaleźć potrzebny materiał.
  Kryteria akceptacji:
  1. Wpisanie frazy filtruje wyniki po front/back.
  2. Pusta fraza przywraca pełną listę.
  3. Wyszukiwanie działa dla znaków diakrytycznych (np. ą, ę, ł) zgodnie z możliwościami bazy.

- ID: US-011
  Tytuł: Edycja fiszki
  Opis: Jako użytkownik chcę edytować fiszkę, aby poprawić błędy lub doprecyzować treść.
  Kryteria akceptacji:
  1. Użytkownik może wejść w tryb edycji dla wybranej fiszki.
  2. Obowiązują limity 200/500 i walidacja jak w tworzeniu.
  3. Po zapisie zmiany są widoczne na liście.

- ID: US-012
  Tytuł: Usunięcie fiszki
  Opis: Jako użytkownik chcę usunąć fiszkę, aby pozbyć się nieaktualnych lub błędnych fiszek.
  Kryteria akceptacji:
  1. System wymaga potwierdzenia usunięcia.
  2. Po potwierdzeniu fiszka znika z listy.

5.3 AI generowanie i review

- ID: US-013
  Tytuł: Wklejenie tekstu do generowania
  Opis: Jako użytkownik chcę wkleić tekst źródłowy, aby AI mogło zaproponować fiszki.
  Kryteria akceptacji:
  1. Pole przyjmuje plain text.
  2. System pokazuje licznik znaków.
  3. Przy długości < 100 lub > 1000 przycisk generowania jest nieaktywny i pokazuje powód.

- ID: US-014
  Tytuł: Wybór liczby fiszek do wygenerowania
  Opis: Jako użytkownik chcę wybrać liczbę fiszek, aby kontrolować koszt i jakość propozycji.
  Kryteria akceptacji:
  1. Użytkownik może wybrać wartość w zakresie 3–12.
  2. Domyślna wartość to 8.

- ID: US-015
  Tytuł: Uruchomienie generowania w ramach limitu
  Opis: Jako użytkownik chcę uruchomić generowanie, jeśli mam dostępny limit, aby otrzymać propozycje fiszek.
  Kryteria akceptacji:
  1. Jeśli pozostały limit żądań > 0, generowanie startuje.
  2. System pokazuje stan ładowania, a po sukcesie przechodzi do ekranu review.
  3. Jeśli żądanie zakończy się błędem, użytkownik widzi komunikat i może spróbować ponownie (o ile limit na to pozwala).

- ID: US-016
  Tytuł: Blokada generowania po wykorzystaniu limitu żądań
  Opis: Jako użytkownik chcę otrzymać jasną informację, że nie mogę generować więcej dziś, aby rozumieć ograniczenie.
  Kryteria akceptacji:
  1. Po wykorzystaniu 10/10 żądań przycisk generowania jest nieaktywny.
  2. Widoczny jest komunikat: limit wykorzystany oraz informacja o czasie resetu.

- ID: US-017
  Tytuł: Review wygenerowanych propozycji
  Opis: Jako użytkownik chcę zobaczyć listę propozycji fiszek, aby zdecydować, które zapisać.
  Kryteria akceptacji:
  1. Każda propozycja pokazuje front i back.
  2. Użytkownik ma przy każdej propozycji akcje: Edytuj, Akceptuj, Odrzuć.
  3. Akcje działają niezależnie dla każdej propozycji.

- ID: US-018
  Tytuł: Edycja propozycji przed akceptacją
  Opis: Jako użytkownik chcę edytować propozycję AI przed akceptacją, aby dopasować treść do mojego stylu nauki.
  Kryteria akceptacji:
  1. Użytkownik może zmienić front/back propozycji przed akceptacją.
  2. Obowiązują limity 200/500 dla zapisywanej fiszki.
  3. Po akceptacji edytowana wersja jest zapisana jako fiszka.

- ID: US-019
  Tytuł: Akceptacja propozycji AI
  Opis: Jako użytkownik chcę zaakceptować pojedynczą propozycję, aby zapisać ją jako fiszkę.
  Kryteria akceptacji:
  1. Akceptacja zapisuje fiszkę w mojej bazie.
  2. Zapisana fiszka pojawia się na liście fiszek.
  3. System zwiększa dzienny licznik zaakceptowanych fiszek AI.

- ID: US-020
  Tytuł: Odrzucenie propozycji AI
  Opis: Jako użytkownik chcę odrzucić propozycję, aby nie zapisywać fiszki niskiej jakości.
  Kryteria akceptacji:
  1. Odrzucona propozycja nie jest zapisana jako fiszka.
  2. System umożliwia przejście do następnych propozycji bez przerwania review.

- ID: US-021
  Tytuł: Blokada akceptacji po wykorzystaniu limitu zaakceptowanych fiszek AI
  Opis: Jako użytkownik chcę wiedzieć, że nie mogę zaakceptować więcej fiszek AI dziś, aby rozumieć ograniczenie kosztowe.
  Kryteria akceptacji:
  1. Po osiągnięciu 20/20 zaakceptowanych fiszek AI przyciski Akceptuj są nieaktywne.
  2. Komunikat wyjaśnia limit i czas resetu.
  3. Odrzucenie nadal jest możliwe.

- ID: US-022
  Tytuł: Ponowna próba akceptacji po resetowaniu limitu
  Opis: Jako użytkownik chcę móc zaakceptować propozycję następnego dnia, jeśli wcześniej limit mnie zablokował.
  Kryteria akceptacji:
  1. Po resecie limitu (następny dzień) akcja Akceptuj działa ponownie.
  2. System poprawnie nalicza akceptacje dla nowego dnia.

5.4 Metryki i spójność logów

- ID: US-023
  Tytuł: Logowanie zdarzenia generowania
  Opis: Jako właściciel produktu chcę, aby każde żądanie generowania było logowane, aby móc wyliczyć KPI i monitorować koszty.
  Kryteria akceptacji:
  1. Dla każdego żądania generowania powstaje wpis w logu (success lub failure).
  2. W logu zapisana jest liczba żądanych i wygenerowanych propozycji.

- ID: US-024
  Tytuł: Logowanie akceptacji per propozycja
  Opis: Jako właściciel produktu chcę, aby akceptacje były logowane per propozycja, aby liczyć KPI 1 z dokładnością per fiszka.
  Kryteria akceptacji:
  1. Dla każdej wygenerowanej propozycji istnieje wpis określający accepted=true/false.
  2. Dla accepted=true log zawiera created_card_id.
  3. Brak obowiązku przechowywania treści odrzuconych propozycji.


## 6. Metryki sukcesu

6.1 KPI 1: Wskaźnik akceptacji fiszek AI
- Definicja: liczba zaakceptowanych propozycji / liczba wygenerowanych propozycji.
- Cel MVP: 75%.
- Sposób pomiaru: wyłącznie na podstawie tabel logów (FR-022, FR-023).
- Uwagi:
  - „Akceptuj” i „Akceptuj po edycji” liczone identycznie.
  - Propozycje odrzucone nie tworzą fiszek; mimo to muszą być policzone w mianowniku KPI 1.

6.2 KPI 2: Udział AI w tworzeniu fiszek
- Definicja: liczba fiszek utworzonych z AI / liczba wszystkich utworzonych fiszek (AI + manual).
- Cel MVP: 75%.
- Sposób pomiaru: z logów akceptacji (AI) oraz z tabeli fiszek (manual vs AI pochodzenie wnioskowane po created_card_id i powiązaniu z generation_id).

6.3 Metryki operacyjne (koszt/abuse)
- Liczba żądań generowania na użytkownika na dzień
  - Limit: 10
  - Pomiar: liczba rekordów logu generowania o status=success lub status=failure, liczona per user_id, per dzień.
- Liczba zaakceptowanych fiszek AI na użytkownika na dzień
  - Limit: 20
  - Pomiar: liczba rekordów logu akceptacji z accepted=true, per user_id, per dzień.

6.4 Checklist PRD (weryfikacja kompletności)
- Testowalność:
  - Każda historyjka ma mierzalne kryteria akceptacji i opisuje obserwowalne zachowanie UI/API.
- Kryteria akceptacji:
  - Są konkretne (limity, stany, blokady) i możliwe do sprawdzenia manualnie lub automatycznie.
- Pokrycie funkcjonalności:
  - Zestaw historyjek obejmuje konta, CRUD fiszek, AI generowanie z review, limity oraz logowanie KPI.
- Uwierzytelnianie i autoryzacja:
  - Osobne historyjki obejmują logowanie, reset hasła, wylogowanie i izolację danych.
