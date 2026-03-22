-- Add support for selecting multiple source playlists per bingo session.
-- Safe to re-run where possible.
-- Uses batching to avoid connection timeouts on large tables.

BEGIN;

ALTER TABLE public.bingo_sessions
ADD COLUMN IF NOT EXISTS playlist_ids integer[];

COMMIT;

-- Backfill existing rows in batches to retain current behavior.
-- Run this separately to avoid timeout on large tables.
-- If it times out, run this block multiple times until no rows are updated.

BEGIN;

WITH rows_to_update AS (
  SELECT id FROM public.bingo_sessions
  WHERE (playlist_ids IS NULL OR cardinality(playlist_ids) = 0)
    AND playlist_id IS NOT NULL
  LIMIT 1000
)
UPDATE public.bingo_sessions
SET playlist_ids = ARRAY[playlist_id]
WHERE id IN (SELECT id FROM rows_to_update);

COMMIT;
