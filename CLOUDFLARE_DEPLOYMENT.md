# Deployment na Cloudflare Pages

## Wymagania

Przed wdrożeniem upewnij się, że masz:

1. Konto Cloudflare z aktywnym projektem Pages
2. Cloudflare API Token z uprawnieniami do Cloudflare Pages
3. Cloudflare Account ID
4. Nazwę projektu Cloudflare Pages

## Secrets GitHub

Dodaj następujące secrets w ustawieniach repozytorium GitHub (Settings → Secrets and variables → Actions):

### Cloudflare
- `CLOUDFLARE_API_TOKEN` - Token API z Cloudflare Dashboard
- `CLOUDFLARE_ACCOUNT_ID` - Account ID z Cloudflare Dashboard
- `CLOUDFLARE_PROJECT_NAME` - Nazwa projektu Pages w Cloudflare

### Aplikacja (Production Environment)
- `SUPABASE_URL` - URL instancji Supabase
- `SUPABASE_ANON_KEY` - Publiczny klucz API Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key Supabase (używany po stronie serwera)
- `OPENROUTER_API_KEY` - Klucz API OpenRouter.ai
- `OPENROUTER_MODEL` - Model AI do użycia (np. "anthropic/claude-3-haiku")

## Konfiguracja Cloudflare Pages

### 1. Utworzenie projektu

Jeśli jeszcze nie masz projektu:
1. Zaloguj się do Cloudflare Dashboard
2. Przejdź do Workers & Pages
3. Kliknij "Create application" → "Pages"
4. Połącz z repozytorium GitHub lub stwórz projekt manualnie

### 2. Konfiguracja zmiennych środowiskowych

W panelu Cloudflare Pages dla twojego projektu:
1. Przejdź do Settings → Environment variables
2. Dodaj wszystkie wymagane zmienne dla środowiska Production:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`

### 3. Build Configuration

Cloudflare Pages będzie używać następującej konfiguracji:
- **Build command**: Automatyczne przez GitHub Actions
- **Build output directory**: `dist`
- **Root directory**: `/`

## Workflow CI/CD

Workflow `.github/workflows/main.yml` automatycznie:

1. **Lint** - Sprawdza jakość kodu
2. **Unit Tests** - Uruchamia testy jednostkowe z pokryciem kodu
3. **Build** - Buduje aplikację dla Cloudflare Pages
4. **Deploy** - Wdraża na Cloudflare Pages

Workflow uruchamia się:
- Przy każdym push do gałęzi `main`
- Manualnie poprzez workflow_dispatch

## Lokalne testowanie buildu

```bash
# Build dla Cloudflare
npm run build

# Sprawdź wygenerowane pliki
ls -la dist/

# Powinny być obecne:
# - _worker.js/ (Cloudflare Worker)
# - _routes.json (routing)
# - _astro/ (assets)
```

## Adapter Cloudflare

Projekt używa `@astrojs/cloudflare` adapter, który:
- Generuje Cloudflare Worker (`_worker.js`)
- Obsługuje SSR (Server-Side Rendering)
- Wspiera Cloudflare Runtime APIs

## Troubleshooting

### Build fails w GitHub Actions
- Sprawdź czy wszystkie secrets są poprawnie ustawione
- Upewnij się, że zmienne środowiskowe są dostępne w job `build`

### Deploy fails
- Zweryfikuj `CLOUDFLARE_API_TOKEN` - powinien mieć uprawnienia do Cloudflare Pages
- Sprawdź czy `CLOUDFLARE_PROJECT_NAME` zgadza się z nazwą w Cloudflare Dashboard
- Upewnij się, że `CLOUDFLARE_ACCOUNT_ID` jest poprawny

### Aplikacja nie działa po deploy
- Sprawdź zmienne środowiskowe w Cloudflare Pages Dashboard
- Przejrzyj logi w Cloudflare Dashboard → Functions
- Upewnij się, że wszystkie wymagane zmienne są ustawione

## Dodatkowe zasoby

- [Astro Cloudflare Adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [GitHub Actions for Cloudflare Pages](https://github.com/cloudflare/pages-action)
