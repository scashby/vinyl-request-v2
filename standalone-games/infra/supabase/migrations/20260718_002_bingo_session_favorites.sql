BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

COMMIT;
