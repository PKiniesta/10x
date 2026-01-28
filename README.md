# 10xCards

## Project Description

10xCards is a web application (MVP) in Polish, designed for pre-university students (primary and secondary school, including technical schools), that accelerates the creation of educational flashcards and facilitates later implementation of learning using the spaced repetition method.

The key value proposition includes:
- Users paste text in Polish, and AI suggests flashcards in question/answer format (front/back).
- Users approve individual suggestions (with editing option), allowing the flashcard database to grow quickly while maintaining quality.
- The MVP focuses on fast creation and management of flashcards; integration with repetitions (SM-2) will be added in the next phase.

## Tech Stack

- **Frontend**: Astro 5 with React for interactive components
  - Astro 5 for creating fast, efficient pages and applications with minimal JavaScript
  - React 19 for interactivity where needed
  - TypeScript 5 for static typing and better IDE support
  - Tailwind 4 for convenient application styling
  - Shadcn/ui for a library of accessible React components to base the UI on

- **Backend**: Supabase as a comprehensive backend solution
  - Provides PostgreSQL database
  - Provides SDKs in multiple languages serving as Backend-as-a-Service
  - Open-source solution that can be hosted locally or on your own server
  - Built-in user authentication

- **AI**: Communication with models via Openrouter.ai service
  - Access to a wide range of models (OpenAI, Anthropic, Google, and many others) to find a solution ensuring high efficiency and low costs
  - Allows setting financial limits on API keys

- **CI/CD and Hosting**:
  - Github Actions for creating CI/CD pipelines
  - DigitalOcean for hosting the application via Docker image

- **Testing**:
  - **Vitest** for unit and integration testing of services, validation, and helpers
  - **MSW (Mock Service Worker)** for mocking API responses (e.g., OpenRouter) during testing
  - **Playwright** for end-to-end (E2E) testing, visual testing, and accessibility (A11y) verification

## Getting Started Locally

### Prerequisites
- Node.js version 22.17.1 (use `.nvmrc` for version management)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/10x-cards.git
   cd 10x-cards
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:4321` (default Astro port).

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run preview` - Preview the production build locally
- `npm run astro` - Run Astro CLI commands
- `npm run lint` - Run ESLint for code linting
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code using Prettier

## Project Scope

### MVP Features
- User accounts (email/password) and password reset.
- Flashcards: manual creation, viewing, searching, editing, deletion.
- AI: generating flashcard suggestions from pasted text (1000–1000 characters), with a parameter for the number of flashcards.
- Review flow: accept/reject per flashcard, with optional editing before acceptance.
- Cost limits: 10 generation requests/day and 20 accepted AI flashcards/day per user.
- Logging AI events to a dedicated database table to count KPIs.

### Out of Scope for MVP
- Spaced repetition module (SM-2), including "Reviews" screen, flashcard queue, and grading (e.g., 4 buttons) with schedule updates.
- Advanced SRS algorithms (Anki/SuperMemo-grade), extensive parameterization, synchronization between devices.
- Import of formats other than plain text (PDF, DOCX, etc.).
- Sharing decks/sets of flashcards between users.
- Integrations with other educational platforms.
- Mobile applications (web-only for now).
- Categories, tags, decks, filters, material hierarchies.

## Project Status

This project is currently in the MVP development phase. Core features for flashcard creation and AI-assisted generation are implemented. Future phases will include spaced repetition functionality.

## License

MIT
