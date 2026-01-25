<conversation_summary>
<decisions>
1. Target users: pre-university students (primary school / technical school); language: Polish only.
2. Core problem: manual creation of high-quality educational flashcards is time-consuming; spaced repetition adoption is hindered.
3. MVP scope includes: AI flashcard generation from pasted text, manual flashcard creation, browse/edit/delete flashcards, basic user accounts, and integration with an existing spaced repetition algorithm.
4. Out of scope for MVP: advanced proprietary SRS (e.g., Anki/SuperMemo-grade), multi-format import (PDF/DOCX/etc.), sharing decks, integrations with other learning platforms, mobile apps (web only initially).
5. Flashcard model: single simple type front/back (Basic Q/A). “Term + definition” is treated as the same front/back format (no separate types). Stored as text only.
6. Manual creation constraints: front max 200 chars, back max 500 chars; one simple “New card” form with immediate validation and character counters.
7. AI generation input: plain text only, length must be 1000–10000 characters.
8. AI generation output control: user provides “How many cards to generate” with a small range and a default value.
9. AI review flow: paste -> AI generates -> review/approval step; user can edit before accepting; acceptance is per single card (no bulk).
10. AI acceptance measurement: “Accept” and “Accept after edit” are counted the same; rejected proposals are not persisted.
11. Rate limits for cost control: 10 AI generation requests/day and 20 AI-accepted cards/day per user; show clear UI messaging about limits.
12. Flashcard list UI: sort by created_at desc, full-text search over front/back, simple pagination (20–50 per page), edit via modal or separate view; no filtering/categorization in MVP.
13. Accounts/auth: email + password + password reset.
514. SRS: use SM-2; one “Reviews” screen with due queue and 3–4 grading buttons; default SM-2 parameters; persist only necessary scheduling fields (e.g., ease, interval, repetitions, due_date).
15. Analytics/measurement approach: dedicated DB table for AI generation logs; KPIs computed only from this table (no external analytics).
16. Delivery constraints: single person, build as fast and as cheaply as possible.
    </decisions>
    <matched_recommendations>
1. Keep one unified flashcard schema (front, back) and treat “definition” as content style, not a separate type -- confirmed by decision #5.
2. Implement a simple manual creation form with immediate validation and character counters -- confirmed by decision #6.
3. Make review/approval a default step and support editing before acceptance -- confirmed by decision #9.
4. Define acceptance at per-card level and log acceptance outcomes to compute AI acceptance rate -- aligned with decisions #10 and #15 (though “rejected not persisted” limits analysis depth).
5. Add a hard input length limit for AI generation and reflect this clearly in UI -- confirmed by decision #7.
6. Provide a simple control for number of cards generated per request to manage quality and cost -- confirmed by decision #8.
7. Enforce per-day rate limits (requests and cards) and show remaining quota in UI -- confirmed by decision #11.
8. Keep card browsing minimal: sorting, full-text search, pagination, and simple edit UX -- confirmed by decision #12.
9. Use SM-2 with a minimal review UI and default parameters; store only essential scheduling fields -- confirmed by decision #14.
10. Use a consistent log/event schema persisted in DB to compute KPIs from first principles -- partially confirmed by decision #15.
    </matched_recommendations>
    <prd_planning_summary>
    a) Main functional requirements (MVP)
    User accounts: register/login via email + password; password reset; store user-scoped flashcards.
    Flashcards CRUD: create (manual), read/list, update, delete.
    Manual create constraints: front <= 200, back <= 500, text only.
    AI flashcard generation:
    Input: plain pasted text, 1000–10000 chars.
    User selects number of cards to generate (small bounded range, default).
    Output: proposed front/back cards.
    AI review/approval workflow:
    Review screen shows generated proposals.
    User can edit a proposal before acceptance.
    Accept/reject actions are per single card only.
    Only accepted cards become saved flashcards; rejected proposals are discarded (not stored).
    Flashcard list screen:
    Sort: newest first (created_at desc).
    Search: full-text over front/back.
    Pagination: 20–50 per page.
    Edit via modal or separate view.
    No tags, decks, filters, or categorization in MVP.
    Spaced repetition (SM-2):
    One “Reviews” view with a due queue.
    3–4 grading buttons.
    Default SM-2 parameters; persist only required scheduling state (e.g., ease, interval, repetitions, due_date).
    Cost and abuse controls:
    Per user limits: 10 generations/day and 20 AI-accepted cards/day, with clear UI communication and remaining quota indicator.
    Logging/metrics:
    Dedicated DB table capturing AI generation logs.
    KPIs computed from this table only (no external analytics tools).
    b) Key user stories and paths
1. Sign up / sign in
   As a student, I create an account and log in so my flashcards are stored and available later.
2. Manual flashcard creation
   As a student, I open “New card”, enter front/back within limits (200/500), and save to quickly add a card without AI.
3. AI-assisted creation with review
   As a student, I paste a Polish text (1000–10000 chars), choose how many cards to generate, run generation, then review proposals.
   For each proposal, I optionally edit and then accept to save it, or reject to discard.
4. Manage existing flashcards
   As a student, I browse my cards (paginated, newest first), search by keywords across front/back, edit a card in a modal/separate view, or delete it.
5. Review session (SM-2)
   As a student, I open “Reviews”, see due cards one by one, grade my recall with 3–4 buttons, and the system schedules the next due date.
   c) Success criteria and measurement
   KPI 1: AI acceptance rate
   Goal: 75% of AI-generated cards are accepted by users.
   Measurement: from DB logs, per card: accepted / generated.
   Note: “accept” and “accept after edit” are treated identically in MVP.
   KPI 2: AI share of created cards
   Goal: users create 75% of their cards using AI.
   Measurement: from DB logs and card creation records: AI\-created cards / total created cards (AI + manual).
   Data source: dedicated DB logging table (explicitly chosen over external analytics).
   Operational constraints metrics (for cost control)
   Enforce and monitor: 10 AI requests/day and 20 AI-accepted cards/day per user.
   d) Constraints and MVP boundaries captured for PRD
   Web only; single developer; minimize time and cost.
   No advanced SRS features beyond SM-2 defaults.
   No import formats beyond paste-text.
   No sharing, integrations, or mobile apps.
   No categorizations/tags/decks in MVP.
   </prd_planning_summary>
   <unresolved_issues>
1. AI logging schema details: exact columns needed to compute KPIs robustly (e.g., generation_id, generated_count, accepted_count, linkage of accepted cards to a generation) are not fully specified, especially since rejected proposals are not persisted.
2. “How many cards” bounds: the “small range” and default value are not explicitly set (e.g., min/max and default).
3. Rate limit behavior details: handling when a user hits the 10 requests/day vs 20 cards/day limit (e.g., do you block generation, or allow generation but prevent acceptance) is not specified.
4. SM-2 parameter defaults: specific defaults and grading mapping (3 vs 4 buttons and how they translate to SM-2 quality values) are not fixed.
5. Full-text search implementation: database/approach for full-text search over front/back is not chosen (impacts PRD non-functional requirements).
6. AI quality safeguards: beyond input length and quotas, no explicit content quality rules are defined (e.g., avoiding overly long answers, deduplication, or minimum/maximum card length).
7. Legal/privacy basics for minors: target users include minors; consent, data retention, and privacy requirements are not addressed.
   </unresolved_issues>
   </conversation_summary>
