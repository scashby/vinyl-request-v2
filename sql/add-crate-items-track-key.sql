-- Add optional track_key to crate_items to support track-level crate entries.
-- When track_key IS NULL: crate item represents a whole album (original behaviour).
-- When track_key IS NOT NULL: crate item represents one specific track on that album.
-- This enables Game Crates (e.g. Bingo: 75 specific tracks, one per album) to sit
-- in the same table as album-level Smart/Manual crates without schema duplication.

ALTER TABLE public.crate_items
  ADD COLUMN IF NOT EXISTS track_key text;

CREATE INDEX IF NOT EXISTS idx_crate_items_track_key
  ON public.crate_items (crate_id, track_key)
  WHERE track_key IS NOT NULL;

-- Also add game_source to crates so the UI can identify game-generated crates.
ALTER TABLE public.crates
  ADD COLUMN IF NOT EXISTS game_source text;
