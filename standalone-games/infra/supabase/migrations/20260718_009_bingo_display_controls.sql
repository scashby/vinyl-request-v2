BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS show_countdown boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recent_calls_limit integer NOT NULL DEFAULT 5;

COMMIT;
