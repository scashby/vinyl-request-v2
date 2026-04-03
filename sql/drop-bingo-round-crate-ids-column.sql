BEGIN;

ALTER TABLE public.bingo_sessions
  DROP COLUMN IF EXISTS round_crate_ids;

COMMIT;
