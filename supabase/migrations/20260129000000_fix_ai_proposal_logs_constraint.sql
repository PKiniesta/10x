-- migration: fix ai_proposal_logs_accepted_card_consistency_check constraint
-- purpose: allow deleting cards that were created via AI without violating the log constraint.
-- the existing constraint required created_card_id to be NOT NULL if accepted = true.
-- However, we have ON DELETE SET NULL on created_card_id, so deleting a card violates this constraint.

begin;

alter table public.ai_proposal_logs
  drop constraint if exists ai_prop_logs_accepted_card_consistency_check;

alter table public.ai_proposal_logs
  add constraint ai_prop_logs_accepted_card_consistency_check
  check (
    (accepted = true)
    or
    (accepted = false and created_card_id is null)
  );

commit;
