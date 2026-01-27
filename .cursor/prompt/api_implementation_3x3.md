Twoim zadaniem jest wdrożenie endpointa interfejsu API REST w oparciu o podany plan wdrożenia. Twoim celem jest stworzenie solidnej i dobrze zorganizowanej implementacji, która zawiera odpowiednią walidację, obsługę błędów i podąża za wszystkimi logicznymi krokami opisanymi w planie.

Najpierw dokładnie przejrzyj dostarczony plan wdrożenia:

<implementation_plan>
plan do enpodinta znajdziesz tutaj doc/implementation-plan/reject-ai-create-card.md
</implementation_plan>

<types>
types.ts
</types>

<implementation_rules>
Przestrzegaj tych regul w trakcie implementacji ktore znajdziesz w folderze .cursor/rules @shared.mdc, @backend.mdc, @astro.mdc)
</implementation_rules>

<implementation_approach>
Realizuj maksymalnie 3 kroki planu implementacji, podsumuj krótko co zrobiłeś i opisz plan na 3 kolejne działania - zatrzymaj w tym momencie pracę i czekaj na mój feedback.
</implementation_approach>

Teraz wykonaj następujące kroki, aby zaimplementować punkt końcowy interfejsu API REST:

1. Przeanalizuj plan wdrożenia:
    - Określ metodę HTTP (GET, POST, PUT, DELETE itp.) dla punktu końcowego.
    - Określenie struktury adresu URL punktu końcowego
    - Lista wszystkich oczekiwanych parametrów wejściowych
    - Zrozumienie wymaganej logiki biznesowej i etapów przetwarzania danych
    - Zwróć uwagę na wszelkie szczególne wymagania dotyczące walidacji lub obsługi błędów.

2. Rozpocznij implementację:
    - Rozpocznij od zdefiniowania funkcji punktu końcowego z prawidłowym dekoratorem metody HTTP.
    - Skonfiguruj parametry funkcji w oparciu o oczekiwane dane wejściowe
    - Wdrożenie walidacji danych wejściowych dla wszystkich parametrów
    - Postępuj zgodnie z logicznymi krokami opisanymi w planie wdrożenia
    - Wdrożenie obsługi błędów dla każdego etapu procesu
    - Zapewnienie właściwego przetwarzania i transformacji danych zgodnie z wymaganiami
    - Przygotowanie struktury danych odpowiedzi

3. Walidacja i obsługa błędów:
    - Wdrożenie dokładnej walidacji danych wejściowych dla wszystkich parametrów
    - Używanie odpowiednich kodów statusu HTTP dla różnych scenariuszy (np. 400 dla błędnych żądań, 404 dla nie znaleziono, 500 dla błędów serwera).
    - Dostarczanie jasnych i informacyjnych komunikatów o błędach w odpowiedzi.
    - Obsługa potencjalnych wyjątków, które mogą wystąpić podczas przetwarzania.

4. Rozważania dotyczące testowania:
    - Należy rozważyć edge case'y i potencjalne problemy, które powinny zostać przetestowane.
    - Upewnienie się, że wdrożenie obejmuje wszystkie scenariusze wymienione w planie.

5. Dokumentacja:
    - Dodaj jasne komentarze, aby wyjaśnić złożoną logikę lub ważne decyzje
    - Dołącz dokumentację dla głównej funkcji i wszelkich funkcji pomocniczych.

Po zakończeniu implementacji upewnij się, że zawiera wszystkie niezbędne importy, definicje funkcji i wszelkie dodatkowe funkcje pomocnicze lub klasy wymagane do implementacji.

Jeśli musisz przyjąć jakieś założenia lub masz jakiekolwiek pytania dotyczące planu implementacji, przedstaw je przed pisaniem kodu.

Pamiętaj, aby przestrzegać najlepszych praktyk projektowania REST API, stosować się do wytycznych dotyczących stylu języka programowania i upewnić się, że kod jest czysty, czytelny i dobrze zorganizowany.