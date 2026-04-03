BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS welcome_heading_text text,
  ADD COLUMN IF NOT EXISTS welcome_message_text text,
  ADD COLUMN IF NOT EXISTS welcome_rules_text text,
  ADD COLUMN IF NOT EXISTS welcome_tiebreak_text text,
  ADD COLUMN IF NOT EXISTS intermission_heading_text text,
  ADD COLUMN IF NOT EXISTS intermission_message_text text,
  ADD COLUMN IF NOT EXISTS intermission_footer_text text,
  ADD COLUMN IF NOT EXISTS thanks_heading_text text,
  ADD COLUMN IF NOT EXISTS thanks_subheading_text text,
  ADD COLUMN IF NOT EXISTS thanks_events_heading_text text;

COMMIT;