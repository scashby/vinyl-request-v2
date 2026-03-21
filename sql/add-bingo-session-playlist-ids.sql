-- Add support for selecting multiple source playlists per bingo session.
-- Safe to re-run where possible.

BEGIN;

ALTER TABLE public.bingo_sessions
ADD COLUMN IF NOT EXISTS playlist_ids integer[];

-- Backfill existing rows to retain current behavior.
UPDATE public.bingo_sessions
SET playlist_ids = ARRAY[playlist_id]
WHERE (playlist_ids IS NULL OR cardinality(playlist_ids) = 0)
  AND playlist_id IS NOT NULL;

COMMIT;
