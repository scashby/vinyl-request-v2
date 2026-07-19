BEGIN;

ALTER TABLE public.sg_game_bingo_calls
  ADD COLUMN IF NOT EXISTS album_name text,
  ADD COLUMN IF NOT EXISTS side text,
  ADD COLUMN IF NOT EXISTS position text;

COMMIT;
