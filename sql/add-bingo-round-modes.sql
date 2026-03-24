BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS round_modes jsonb;

COMMIT;
