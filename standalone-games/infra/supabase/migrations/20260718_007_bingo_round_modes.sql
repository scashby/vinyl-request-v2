BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS current_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS round_modes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
