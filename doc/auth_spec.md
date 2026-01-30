# Specyfikacja Architektoniczna: Moduł Autentykacji i Autoryzacji

Niniejszy dokument opisuje architekturę modułu rejestracji, logowania oraz odzyskiwania hasła dla aplikacji do generowania fiszek AI, zgodnie z wymaganiami PRD (sekcja 3.1) oraz wybranym stackiem technologicznym.

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA (UI)

### Podział na strony Astro i komponenty React
Zastosowany zostanie model hybrydowy: Astro będzie odpowiedzialne za routing i layouty serwerowe (SSR), natomiast React 19 obsłuży interaktywne formularze z walidacją w czasie rzeczywistym.

#### Nowe Strony (Astro)
- `src/pages/login.astro`: Główna strona logowania. Kontener dla `LoginForm`.
- `src/pages/register.astro`: Strona rejestracji użytkownika. Kontener dla `RegisterForm`.
- `src/pages/forgot-password.astro`: Formularz zgłoszenia chęci resetu hasła.
- `src/pages/reset-password.astro`: Strona docelowa po kliknięciu w link z maila (wymaga sesji uwierzytelnionej).

#### Endpointy API (Server-Only)
Zlokalizowane w `src/pages/api/auth/`:
- `callback.ts`: Obsługuje wymianę kodu (PKCE flow) na sesję i przekierowuje użytkownika.
- `logout.ts`: Czyści sesję i ciasteczka.
- `login.ts`: Przyjmuje dane z `LoginForm`, loguje użytkownika i ustawia ciasteczka.
- `register.ts`: Obsługuje proces rejestracji.
- `reset-password.ts`: Inicjuje procedurę resetu (wysyłka e-mail).

#### Komponenty React (Interaktywne)
Zlokalizowane w `src/components/auth/`:
- `LoginForm.tsx`: Obsługa pól `email`, `password`. Wykorzystuje `shadcn/ui` (Form, Input, Button).
- `RegisterForm.tsx`: Zawiera dodatkową walidację siły hasła oraz potwierdzenie jego powtórzenia.
- `ForgotPasswordForm.tsx`: Prosty formularz z jednym polem email.
- `ResetPasswordForm.tsx`: Formularz ustawiania nowego hasła.

#### Rozszerzenie istniejących elementów
- `src/layouts/Layout.astro`: Dodanie logiki sprawdzającej obecność użytkownika (`Astro.locals.user`). Nagłówek będzie wyświetlał:
  - **Dla gości:** Linki "Zaloguj się" / "Zarejestruj".
  - **Dla zalogowanych:** Menu profilu, informację o pozostałych limitach (FR-021) oraz przycisk "Wyloguj".
- `src/components/Navigation.astro`: Nawigacja boczna/górna wyświetlająca link do "Moje Fiszki" oraz "Generuj" tylko dla zalogowanych użytkowników.

### Walidacja i Obsługa Błędów
- **Po stronie klienta:** Użycie `react-hook-form` z resolverem `zod` w komponentach React.
- **Po stronie serwera:** Ponowna walidacja schematem `zod` w API Endpoints przed wysłaniem żądania do Supabase.
- **Komunikaty:** Mapowanie technicznych błędów Supabase (np. `invalid_credentials`, `user_already_exists`) na przyjazne komunikaty w języku polskim wyświetlane za pomocą komponentów `Alert` z `shadcn/ui`.

---

## 2. LOGIKA BACKENDOWA

### Middleware (`src/middleware/index.ts`)
Middleware będzie pełnił kluczową rolę w zapewnieniu bezpieczeństwa i obsłudze SSR:
1.  **Inicjalizacja Klienta:** Tworzenie instancji klienta Supabase z autentykacją opartą na ciasteczkach dla każdego żądania (Server Side Auth).
2.  **Auth Guard:** Sprawdzanie ścieżki żądania. Jeśli użytkownik nie jest zalogowany, a próbuje wejść na `/cards/*`, `/api/cards/*` lub `/api/ai/*`, następuje przekierowanie na `/login`.
3.  **Local Context:** Wypełnianie `context.locals.user` danymi z sesji Supabase, co umożliwi dostęp do ID użytkownika na wszystkich stronach Astro bez ponownego odpytywania bazy.


### Serwisy i Walidacja
- `src/lib/services/auth.service.ts`: Centralny punkt logiki autentykacji, separujący implementację Supabase od reszty aplikacji.
- `src/lib/validation/auth.ts`: Definicje schematów Zod dla logowania, rejestracji i zmiany hasła (wspólne dla frontu i backendu).

---

## 3. SYSTEM AUTENTYKACJI (Supabase Auth)

### Konfiguracja i Integracja
System wykorzysta natywne mechanizmy **Supabase Auth** zintegrowane z Astro SSR:
- **Mechanizm sesji:** Oparty na ciasteczkach (Cookies) z flagami `HttpOnly`, `Secure` i `SameSite: Lax`. Pozwala to na uniknięcie problemów z bezpieczeństwem `localStorage` oraz umożliwia SSR (renderowanie strony już z danymi użytkownika).
- **PKCE Flow:** Wykorzystanie standardu Proof Key for Code Exchange (PKCE) dla bezpiecznej wymiany kodów autoryzacyjnych na tokeny sesyjne w środowisku serwerowym.

### Modele Danych i Dostęp
- **Dane użytkownika:** Przechowywane w schemacie `auth.users` (zarządzanym przez Supabase).
- **Relacje:** Tabela `cards` w schemacie `public` będzie posiadać kolumnę `user_id` typu UUID z kluczem obcym do `auth.users.id`.
- **Zabezpieczenie danych (RLS):** Włączenie Row Level Security (RLS) dla tabeli `cards` oraz logów AI. Przykładowa polityka:
  ```sql
  CREATE POLICY "Users can only see their own cards"
  ON public.cards FOR ALL
  USING (auth.uid() = user_id);
  ```

### Obsługa Resetu Hasła
1. Użytkownik przesyła formularz "Zapomniałem hasła".
2. Supabase wysyła e-mail z linkiem zawierającym jednorazowy token.
3. Link kieruje na `/auth/callback?type=recovery`, który wymienia kod na sesję i przekierowuje na `/reset-password`.
4. Strona `/reset-password` weryfikuje aktywną sesję i pozwala na update hasła poprzez `supabase.auth.updateUser()`.

---

## 4. PODSUMOWANIE SCENARIUSZY

| Scenariusz | Komponent UI | Mechanizm Backendowy | Akcja Końcowa |
| :--- | :--- | :--- | :--- |
| **Rejestracja** | `RegisterForm.tsx` | `supabase.auth.signUp()` | Link aktywacyjny na email |
| **Logowanie** | `LoginForm.tsx` | API Endpoint + Cookies | Przekierowanie na `/cards` |
| **Dostęp do fiszek** | `CardsList.tsx` | Middleware + RLS | Wyświetlenie tylko własnych fiszek |
| **Wygasła sesja** | Dowolna strona `/cards` | Middleware check | Przekierowanie na `/login` |
| **Reset hasła** | `ForgotPasswordForm.tsx` | `auth.resetPasswordForEmail()` | Mail z linkiem do `/api/auth/callback` |
