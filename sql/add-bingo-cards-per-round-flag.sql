BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS cards_per_round_enabled boolean NOT NULL DEFAULT false;

COMMIT;