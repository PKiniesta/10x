# REST API Plan

This document defines a REST API plan for the 10xCards MVP.

The plan is based on:
- DB schema plan: `doc/db_plan.md`
- Actual migration: `supabase/migrations/20260126000000_create_core_schema.sql`
- PRD: `doc/prd.md`
- Tech stack: `doc/tech_stack.md`

> Assumptions (explicit because some details aren’t fully specified in PRD):
> 1. This API is implemented as Astro Server Endpoints under `src/pages/api/**`.
> 2. Authentication uses Supabase Auth (email/password) and a session stored in cookies; endpoints read the user from `context.locals.supabase.auth.getUser()`.
> 3. The client cannot write to AI log tables directly due to RLS (per DB plan). Therefore, AI-related flows are implemented as server-side endpoints that use either:
>    - Postgres RPC (SECURITY DEFINER), or
>    - Supabase service role on the server.
>    This plan describes the REST endpoints; the internal DB mechanism can be selected during implementation.
> 4. We don’t persist the generated AI proposal *content* in the DB (per PRD/DB plan). The “review screen” therefore requires the client to keep proposals in memory, or the API needs an ephemeral token to re-fetch proposals. This plan proposes an **ephemeral review token** with short TTL.

---

## 1. Resources

1. **Cards** → `public.cards`
   - Flashcards (manual or accepted from AI)
   - Key columns: `id`, `user_id`, `front`, `back`, `origin`, `ai_generation_id`, `created_at`, `updated_at`

2. **AI generation requests (logs)** → `public.ai_generation_requests`
   - Every generation attempt counts toward the daily limit (success and failure)
   - Key columns: `generation_id`, `user_id`, `input_length`, `requested_cards_count`, `generated_cards_count`, `status`, `provider`, `model`, `error_code`, `error_message`, `created_at`

3. **AI proposal decision logs** → `public.ai_proposal_logs`
   - One row per proposal in a generation session; stores accepted/rejected + card reference
   - Key columns: `generation_id`, `proposal_index`, `accepted`, `created_card_id`, `user_id`, `created_at`

4. **Limits (computed resource)** → derived from the logs
   - Daily generation requests limit: 10/day/user
   - Daily accepted AI cards limit: 20/day/user

5. **Auth (Supabase Auth)** → `auth.users`
   - Implemented via Supabase Auth, not custom tables

---

## 2. Endpoints

### Conventions (applies to all endpoints)

- Base path: `/api`
- Content type: `application/json; charset=utf-8`
- Error shape (consistent across endpoints):

  ```json
  {
    "error": {
      "code": "string",
      "message": "string",
      "details": {"any": "json"}
    }
  }
  ```

- Pagination pattern for list endpoints:
  - Query params:
    - `page` (1-based, default 1)
    - `pageSize` (default 20, allowed range 20–50 per PRD FR-009)
  - Response includes:

  ```json
  {
    "data": [/* items */],
    "page": 1,
    "pageSize": 20,
    "total": 123
  }
  ```

- Sorting:
  - Default: `created_at desc` (PRD FR-009)
  - Query param:
    - `sort=createdAt:desc|asc` (and optionally `updatedAt:desc|asc`)

- Filtering/search:
  - `q` for searching `front/back` (PRD FR-010)
  - MVP can use `ILIKE` (per DB plan)

- Authentication:
  - Endpoints that modify or return user-specific data require an authenticated user.
  - Standard error:
    - `401 Unauthorized` if not signed in.

---

### 2.1 Cards

#### 2.1.1 List cards
- **Method:** GET
- **Path:** `/api/cards`
- **Description:** Returns user’s cards, newest first; supports pagination and basic search on `front/back`.
- **Query params:**
  - `page` (default 1)
  - `pageSize` (default 20, min 20, max 50)
  - `q` (optional; search term)
  - `sort` (optional; default `createdAt:desc`)
- **Request JSON:** none
- **Response JSON:**

  ```json
  {
    "data": [
      {
        "id": "uuid",
        "front": "string",
        "back": "string",
        "origin": "manual|ai",
        "aiGenerationId": "uuid|null",
        "createdAt": "2026-01-26T12:34:56.000Z",
        "updatedAt": "2026-01-26T12:34:56.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 123
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `400 Bad Request` (`INVALID_PAGINATION`, `INVALID_SORT`)


#### 2.1.2 Get card by id
- **Method:** GET
- **Path:** `/api/cards/{cardId}`
- **Description:** Returns a single card owned by the user.
- **Query params:** none
- **Request JSON:** none
- **Response JSON:**

  ```json
  {
    "id": "uuid",
    "front": "string",
    "back": "string",
    "origin": "manual|ai",
    "aiGenerationId": "uuid|null",
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `404 Not Found` (`CARD_NOT_FOUND`)


#### 2.1.3 Create manual card
- **Method:** POST
- **Path:** `/api/cards`
- **Description:** Creates a new manual card.
- **Query params:** none
- **Request JSON:**

  ```json
  {
    "front": "string",
    "back": "string"
  }
  ```

- **Response JSON:**

  ```json
  {
    "id": "uuid",
    "front": "string",
    "back": "string",
    "origin": "manual",
    "aiGenerationId": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```

- **Success codes:**
  - `201 Created`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `400 Bad Request` (`VALIDATION_ERROR`) when:
    - `front` is empty or longer than 200 chars (DB constraint: `cards_front_length_check`)
    - `back` is empty or longer than 500 chars (DB constraint: `cards_back_length_check`)


#### 2.1.4 Update card
- **Method:** PATCH
- **Path:** `/api/cards/{cardId}`
- **Description:** Updates front/back for an existing card.
- **Query params:** none
- **Request JSON:**

  ```json
  {
    "front": "string (optional)",
    "back": "string (optional)"
  }
  ```

- **Response JSON:**

  ```json
  {
    "id": "uuid",
    "front": "string",
    "back": "string",
    "origin": "manual|ai",
    "aiGenerationId": "uuid|null",
    "createdAt": "...",
    "updatedAt": "..."
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `404 Not Found` (`CARD_NOT_FOUND`)
  - `400 Bad Request` (`VALIDATION_ERROR`) for length limits (200/500)


#### 2.1.5 Delete card
- **Method:** DELETE
- **Path:** `/api/cards/{cardId}`
- **Description:** Hard-deletes a card (allowed by DB design).
- **Query params:** none
- **Request JSON:** none
- **Response JSON:**

  ```json
  { "ok": true }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `404 Not Found` (`CARD_NOT_FOUND`)

---

### 2.2 Limits

#### 2.2.1 Get today’s limits and remaining quota
- **Method:** GET
- **Path:** `/api/limits/today`
- **Description:** Returns remaining daily quota for:
  - AI generation requests (10/day)
  - Accepted AI cards (20/day)
  Also returns the UTC reset timestamp to display in UI (PRD FR-020/FR-021).
- **Query params:** none
- **Request JSON:** none
- **Response JSON:**

  ```json
  {
    "timezone": "UTC",
    "resetAt": "2026-01-27T00:00:00.000Z",
    "generationRequests": {
      "limit": 10,
      "used": 3,
      "remaining": 7
    },
    "aiAcceptedCards": {
      "limit": 20,
      "used": 12,
      "remaining": 8
    }
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)

---

### 2.3 AI generation (business-flow endpoints)

These endpoints implement the PRD’s non-CRUD business logic:
- generation request logging (counts toward 10/day)
- handling success/failure
- review and per-proposal accept/reject logging
- accepting creates a card (counts toward 20/day)

Because the DB enforces that clients cannot write to `ai_generation_requests` and `ai_proposal_logs` under RLS (migration explicitly creates no insert/update/delete policies), these endpoints must run on the server with elevated privileges.

#### 2.3.1 Start AI generation
- **Method:** POST
- **Path:** `/api/ai/generations`
- **Description:**
  - Validates input length (1000–10000) and requested card count (3–12).
  - Enforces daily generation limit (10/day) and writes a row to `ai_generation_requests`.
  - Calls OpenRouter to generate card proposals.
  - On success: sets `status=success`, `generated_cards_count`.
  - On failure: sets `status=failure`, stores `error_code` + safe `error_message` (no user input).
  - Returns proposals + a **review token**.

- **Query params:** none
- **Request JSON:**

  ```json
  {
    "inputText": "string",
    "requestedCardsCount": 8
  }
  ```

- **Response JSON (success):**

  ```json
  {
    "ok": true,
    "generationId": "uuid",
    "reviewToken": "string",
    "proposals": [
      { "proposalIndex": 0, "front": "...", "back": "..." },
      { "proposalIndex": 1, "front": "...", "back": "..." }
    ],
    "limits": {
      "generationRequestsRemaining": 7,
      "aiAcceptedCardsRemaining": 8,
      "resetAt": "2026-01-27T00:00:00.000Z"
    }
  }
  ```

- **Response JSON (failure):**

  ```json
  {
    "ok": false,
    "generationId": "uuid",
    "error": {
      "code": "AI_GENERATION_FAILED",
      "message": "Generation failed. Please try again.",
      "details": {
        "provider": "openrouter",
        "model": "..."
      }
    },
    "limits": {
      "generationRequestsRemaining": 7,
      "aiAcceptedCardsRemaining": 8,
      "resetAt": "2026-01-27T00:00:00.000Z"
    }
  }
  ```

- **Success codes:**
  - `201 Created` for success
  - `502 Bad Gateway` (or `500`) for upstream failure, but still with a logged request.
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `400 Bad Request` (`VALIDATION_ERROR`) when:
    - input length is out of range (DB constraint mirrors this via `input_length between 1000 and 10000`)
    - requested cards count out of range (DB: `requested_cards_count between 3 and 12`)
  - `429 Too Many Requests` (`DAILY_GENERATION_LIMIT_REACHED`) when user already logged 10 requests today (UTC).


#### 2.3.2 Accept an AI proposal (creates a card)
- **Method:** POST
- **Path:** `/api/ai/generations/{generationId}/proposals/{proposalIndex}/accept`
- **Description:**
  - Validates `front/back` length (<= 200/500).
  - Enforces daily accept limit (20/day) based on `ai_proposal_logs where accepted=true`.
  - Writes/upsserts `ai_proposal_logs` for (`user_id`,`generation_id`,`proposal_index`) with `accepted=true`.
  - Creates a card in `cards` with `origin='ai'` and `ai_generation_id=generationId`.

- **Query params:** none
- **Request JSON:**

  ```json
  {
    "front": "string",
    "back": "string",
    "reviewToken": "string"
  }
  ```

  Notes:
  - `reviewToken` binds the request to a prior generation response (mitigates accepting arbitrary generation ids / indices).
  - `front/back` reflect “accept as-is” or “edit then accept” (PRD FR-018).

- **Response JSON:**

  ```json
  {
    "card": {
      "id": "uuid",
      "front": "string",
      "back": "string",
      "origin": "ai",
      "aiGenerationId": "uuid",
      "createdAt": "...",
      "updatedAt": "..."
    },
    "log": {
      "generationId": "uuid",
      "proposalIndex": 0,
      "accepted": true,
      "createdCardId": "uuid",
      "createdAt": "..."
    },
    "limits": {
      "aiAcceptedCardsRemaining": 7,
      "resetAt": "2026-01-27T00:00:00.000Z"
    }
  }
  ```

- **Success codes:**
  - `201 Created`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `400 Bad Request` (`VALIDATION_ERROR`) for 200/500 length rules
  - `401 Unauthorized` or `403 Forbidden` (`INVALID_REVIEW_TOKEN`) if token missing/expired
  - `404 Not Found` (`GENERATION_NOT_FOUND`) if generation doesn’t exist for user
  - `409 Conflict` (`PROPOSAL_ALREADY_DECIDED`) if already accepted/rejected and the API disallows changing decisions
  - `429 Too Many Requests` (`DAILY_AI_ACCEPT_LIMIT_REACHED`) when 20 accepted today (PRD FR-021)


#### 2.3.3 Reject an AI proposal
- **Method:** POST
- **Path:** `/api/ai/generations/{generationId}/proposals/{proposalIndex}/reject`
- **Description:**
  - Logs `accepted=false` to `ai_proposal_logs` (upsert).
  - Does not create a card (PRD FR-019).
- **Query params:** none
- **Request JSON:**

  ```json
  {
    "reviewToken": "string"
  }
  ```

- **Response JSON:**

  ```json
  {
    "ok": true,
    "log": {
      "generationId": "uuid",
      "proposalIndex": 0,
      "accepted": false,
      "createdCardId": null,
      "createdAt": "..."
    }
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `401 Unauthorized` or `403 Forbidden` (`INVALID_REVIEW_TOKEN`)
  - `404 Not Found` (`GENERATION_NOT_FOUND`)
  - `409 Conflict` (`PROPOSAL_ALREADY_DECIDED`) if the API disallows changing decisions


#### 2.3.4 Get generation log (optional)
- **Method:** GET
- **Path:** `/api/ai/generations/{generationId}`
- **Description:** Returns the aggregated generation request log entry (read-only).
- **Response JSON:**

  ```json
  {
    "generationId": "uuid",
    "status": "success|failure",
    "inputLength": 1234,
    "requestedCardsCount": 8,
    "generatedCardsCount": 8,
    "provider": "openrouter",
    "model": "...",
    "createdAt": "..."
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized` (`AUTH_REQUIRED`)
  - `404 Not Found` (`GENERATION_NOT_FOUND`)


#### 2.3.5 List generation history (optional)
- **Method:** GET
- **Path:** `/api/ai/generations`
- **Description:** List generation attempts for user (read-only), newest first.
- **Query params:**
  - `page`, `pageSize`
- **Response JSON:**

  ```json
  {
    "data": [
      {
        "generationId": "uuid",
        "status": "success|failure",
        "requestedCardsCount": 8,
        "generatedCardsCount": 8,
        "createdAt": "..."
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 123
  }
  ```

- **Success codes:**
  - `200 OK`

---

### 2.4 AI logs / KPI (read-only)

These endpoints are optional for MVP UI but useful for monitoring and verifying PRD FR-024.

#### 2.4.1 KPI summary
- **Method:** GET
- **Path:** `/api/metrics/kpi`
- **Description:** Returns KPI 1 and KPI 2 for the authenticated user (or for admin, globally).
- **Query params (optional):**
  - `from` (ISO date)
  - `to` (ISO date)
- **Response JSON:**

  ```json
  {
    "kpi1": {
      "name": "AI acceptance rate",
      "accepted": 75,
      "generated": 100,
      "value": 0.75
    },
    "kpi2": {
      "name": "AI share of created cards",
      "aiCards": 75,
      "allCards": 100,
      "value": 0.75
    }
  }
  ```

- **Success codes:**
  - `200 OK`
- **Error codes:**
  - `401 Unauthorized`

---

## 3. Authentication and Authorization

### 3.1 Authentication mechanism

- Supabase Auth (email/password) satisfies:
  - PRD FR-001 (registration), FR-002 (login/session), FR-003 (password reset)
- Session handling:
  - Store Supabase auth session in cookies; Astro endpoints retrieve user via `context.locals.supabase`.

### 3.2 Authorization model

- **Cards**: enforced by RLS policies:
  - users can SELECT/UPDATE/DELETE only rows with `user_id = auth.uid()`
  - users can INSERT only manual cards (`origin='manual'` and `ai_generation_id is null`) (see migration comment)

- **AI log tables** (`ai_generation_requests`, `ai_proposal_logs`):
  - RLS allows SELECT for authenticated users only for their own rows
  - No INSERT/UPDATE/DELETE policies exist, so clients cannot write
  - Writes happen via server endpoints with elevated privileges (RPC or service role)

### 3.3 Rate limiting and abuse prevention

- DB-level daily limits are the primary cost-control mechanism:
  - 10 generation requests/day/user (PRD FR-020)
  - 20 accepted AI cards/day/user (PRD FR-020)

- API-level rate limiting (recommended defense-in-depth):
  - per-IP + per-user token bucket (e.g., 60 requests/minute) for public endpoints
  - stricter per-user rate on `/api/ai/generations` (e.g., 10/minute) to reduce abuse
  - return `429 Too Many Requests` with `Retry-After`

### 3.4 Data privacy

- Do not store pasted input text in the DB.
- Do not store rejected proposal content.
- Store `error_message` as a short technical message without user-provided data (DB plan notes this explicitly).

---

## 4. Validation and Business Logic

### 4.1 Validation rules by resource (derived from DB constraints + PRD)

#### Cards (`public.cards`)
- `front`:
  - required
  - max length 200 (`cards_front_length_check`)
- `back`:
  - required
  - max length 500 (`cards_back_length_check`)
- `origin`:
  - must be `manual` or `ai` (`cards_origin_check`)
- `ai_generation_id`:
  - must be NULL when `origin='manual'`
  - must be NOT NULL when `origin='ai'` (`cards_origin_ai_generation_consistency_check`)

#### AI generation requests (`public.ai_generation_requests`)
- `input_length`:
  - required
  - 1000–10000 (`ai_gen_req_input_length_check`) (PRD FR-013)
- `requested_cards_count`:
  - required
  - 3–12 (`ai_gen_req_requested_cards_count_check`) (PRD FR-014)
- `status`:
  - `success|failure` (`ai_gen_req_status_check`)
- `generated_cards_count`:
  - if `status='success'` must be not null (`ai_gen_req_success_requires_generated_count`)
  - range 0–12 (`ai_gen_req_generated_cards_count_check`)

#### AI proposal logs (`public.ai_proposal_logs`)
- `proposal_index`:
  - integer >= 0 (`ai_prop_logs_proposal_index_check`)
- unique decision per proposal:
  - UNIQUE (`user_id`, `generation_id`, `proposal_index`) (`ai_prop_logs_user_generation_proposal_unique`)
- accepted/card consistency:
  - accepted=true requires `created_card_id`
  - accepted=false requires `created_card_id is null` (`ai_prop_logs_accepted_card_consistency_check`)

### 4.2 Business logic mapping (PRD → API)

1. **Manual flashcards CRUD** (PRD FR-007..FR-012)
   - Implemented via `/api/cards` endpoints.

2. **AI generation with limits** (PRD FR-013..FR-016, FR-020..FR-021)
   - `/api/ai/generations` validates input and enforces 10/day.
   - Returns remaining quota via `/api/limits/today` or inline `limits`.

3. **Mandatory review + per-proposal decision** (PRD FR-017..FR-020)
   - `/api/ai/generations/{generationId}/proposals/{proposalIndex}/accept`
   - `/api/ai/generations/{generationId}/proposals/{proposalIndex}/reject`

4. **No persistence of rejected proposal content** (PRD FR-019)
   - API never writes proposal payloads to DB; only logs decisions.

5. **KPI logging and derivability** (PRD FR-022..FR-024)
   - Generation requests and proposal logs allow computing:
     - KPI 1: accepted proposals / generated proposals
     - KPI 2: AI-created cards / all cards
   - Optional endpoint `/api/metrics/kpi` provides user-facing insight or admin verification.

### 4.3 Edge cases to handle explicitly

- Accepting after the daily accept limit is reached:
  - Reject must still work (PRD FR-021).
  - API returns `429 DAILY_AI_ACCEPT_LIMIT_REACHED` for accept endpoints, but allows reject.

- Duplicate decision calls (double-clicks / retries):
  - Use idempotency behavior:
    - Either return `200 OK` with existing log/card if already accepted, or
    - Reject with `409 PROPOSAL_ALREADY_DECIDED`.
  - The DB unique constraint enforces uniqueness; the API should translate constraint violations into a stable error.

- Generation retry after failure:
  - Each attempt consumes one request (PRD + DB plan: "success and failure count").

- Timezone:
  - Limits reset at UTC midnight; expose `resetAt` to UI (PRD FR-020).

- Search correctness:
  - MVP uses `ILIKE` on `front/back` and respects pagination/sorting`.

