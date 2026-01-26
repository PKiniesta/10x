-- migration: create core schema for 10xcards mvp
-- purpose:
--   - create core tables: public.cards, public.ai_generation_requests, public.ai_proposal_logs
--   - add constraints and indexes per doc/db-plan.md
--   - enable row level security (rls) and define per-role policies
--   - create trigger to maintain cards.updated_at
-- affected objects:
--   - extensions: pgcrypto
--   - tables: public.cards, public.ai_generation_requests, public.ai_proposal_logs
--   - functions: public.set_updated_at()
--   - trigger: public.cards_set_updated_at
-- notes:
--   - all statements are lowercase for consistency.
--   - rls is enabled on every new table. policies are split per action and per role (anon/authenticated).
--   - log tables are read-only for clients; writes are intended via rpc (security definer) or service role.

begin;

-- ensure uuid generation is available.
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- helper: updated_at trigger
-- -----------------------------------------------------------------------------
-- behavior: keeps updated_at in sync on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- table: public.ai_generation_requests
-- -----------------------------------------------------------------------------
-- stores a log of every ai generation request (success and failure) for limits/kpis.
create table if not exists public.ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),

  input_length integer not null,
  requested_cards_count integer not null,
  generated_cards_count integer,

  status text not null,
  provider text,
  model text,
  error_code text,
  error_message text,

  constraint ai_gen_req_generation_id_unique unique (generation_id),

  constraint ai_gen_req_input_length_check
    check (input_length between 1000 and 10000),

  constraint ai_gen_req_requested_cards_count_check
    check (requested_cards_count between 3 and 12),

  constraint ai_gen_req_generated_cards_count_check
    check (generated_cards_count is null or generated_cards_count between 0 and 12),

  constraint ai_gen_req_status_check
    check (status in ('success', 'failure')),

  -- consistency: if success, we must know how many cards were generated.
  constraint ai_gen_req_success_requires_generated_count
    check (status <> 'success' or generated_cards_count is not null)
);

-- indexes to support limit counting and history display.
create index if not exists ai_gen_req_user_created_at_idx
  on public.ai_generation_requests (user_id, created_at desc);

create index if not exists ai_gen_req_generation_id_idx
  on public.ai_generation_requests (generation_id);

-- rls: users can only read their own logs; no direct writes from client roles.
alter table public.ai_generation_requests enable row level security;

-- select policies (split by role).
create policy ai_gen_req_select_anon
  on public.ai_generation_requests
  for select
  to anon
  using (false);

create policy ai_gen_req_select_authenticated
  on public.ai_generation_requests
  for select
  to authenticated
  using (user_id = auth.uid());

-- no insert/update/delete policies are created on purpose.
-- without policies, postgres denies these actions under rls for anon/authenticated.

-- -----------------------------------------------------------------------------
-- table: public.cards
-- -----------------------------------------------------------------------------
-- stores user flashcards, either manual or accepted from ai.
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),

  front text not null,
  back text not null,

  origin text not null,
  ai_generation_id uuid,

  source_title text,
  source_ref text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cards_front_length_check
    check (char_length(front) <= 200),

  constraint cards_back_length_check
    check (char_length(back) <= 500),

  constraint cards_origin_check
    check (origin in ('manual', 'ai')),

  -- consistency between origin and ai_generation_id.
  constraint cards_origin_ai_generation_consistency_check
    check (
      (origin = 'manual' and ai_generation_id is null)
      or
      (origin = 'ai' and ai_generation_id is not null)
    )
);

-- note: we intentionally do not add a foreign key from cards.ai_generation_id to
-- ai_generation_requests.generation_id in mvp to keep retries/workflows flexible.

create index if not exists cards_user_created_at_idx
  on public.cards (user_id, created_at desc);

create index if not exists cards_user_updated_at_idx
  on public.cards (user_id, updated_at desc);

-- maintain updated_at automatically.
drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
before update on public.cards
for each row
execute function public.set_updated_at();

-- rls: users can only access their own cards.
alter table public.cards enable row level security;

-- select policies.
create policy cards_select_anon
  on public.cards
  for select
  to anon
  using (false);

create policy cards_select_authenticated
  on public.cards
  for select
  to authenticated
  using (user_id = auth.uid());

-- insert policies.
-- important: we allow only manual card inserts from the client to prevent
-- spoofing ai acceptance. ai-origin cards should be inserted via rpc/service role.
create policy cards_insert_anon
  on public.cards
  for insert
  to anon
  with check (false);

create policy cards_insert_authenticated
  on public.cards
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and origin = 'manual'
    and ai_generation_id is null
  );

-- update policies.
create policy cards_update_anon
  on public.cards
  for update
  to anon
  using (false)
  with check (false);

create policy cards_update_authenticated
  on public.cards
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- delete policies.
create policy cards_delete_anon
  on public.cards
  for delete
  to anon
  using (false);

create policy cards_delete_authenticated
  on public.cards
  for delete
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- table: public.ai_proposal_logs
-- -----------------------------------------------------------------------------
-- logs acceptance/rejection decisions per proposal within a generation session.
create table if not exists public.ai_proposal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  generation_id uuid not null,
  proposal_index integer not null,
  accepted boolean not null,
  created_at timestamptz not null default now(),
  created_card_id uuid,

  constraint ai_prop_logs_generation_id_fk
    foreign key (generation_id)
    references public.ai_generation_requests (generation_id)
    on delete restrict,

  constraint ai_prop_logs_created_card_id_fk
    foreign key (created_card_id)
    references public.cards (id)
    on delete set null,

  constraint ai_prop_logs_proposal_index_check
    check (proposal_index >= 0),

  constraint ai_prop_logs_user_generation_proposal_unique
    unique (user_id, generation_id, proposal_index),

  -- consistency between accepted and created_card_id.
  constraint ai_prop_logs_accepted_card_consistency_check
    check (
      (accepted = true and created_card_id is not null)
      or
      (accepted = false and created_card_id is null)
    )
);

create index if not exists ai_prop_logs_user_created_at_idx
  on public.ai_proposal_logs (user_id, created_at desc);

create index if not exists ai_prop_logs_user_generation_proposal_idx
  on public.ai_proposal_logs (user_id, generation_id, proposal_index);

create index if not exists ai_prop_logs_generation_id_idx
  on public.ai_proposal_logs (generation_id);

-- partial index helps count daily accepted proposals.
create index if not exists ai_prop_logs_user_created_at_accepted_idx
  on public.ai_proposal_logs (user_id, created_at desc)
  where accepted = true;

-- rls: users can only read their own logs; no direct writes from client roles.
alter table public.ai_proposal_logs enable row level security;

create policy ai_prop_logs_select_anon
  on public.ai_proposal_logs
  for select
  to anon
  using (false);

create policy ai_prop_logs_select_authenticated
  on public.ai_proposal_logs
  for select
  to authenticated
  using (user_id = auth.uid());

-- no insert/update/delete policies are created on purpose.

commit;
