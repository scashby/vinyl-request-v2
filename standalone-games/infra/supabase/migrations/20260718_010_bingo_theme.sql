BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS theme_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme_name text;

COMMIT;
