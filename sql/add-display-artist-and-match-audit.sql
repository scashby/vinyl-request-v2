-- Per-item artist correction, mirroring display_title.
ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS display_artist text;

-- Per-item match provenance: how this row was resolved.
ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS match_type text; -- 'exact' | 'fuzzy' | 'custom' | 'manual'
ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS match_score numeric;

-- Persisted, non-ephemeral import audit on the playlist itself, so it's
-- never dependent on a UI banner staying on screen or up to date.
ALTER TABLE public.collection_playlists
  ADD COLUMN IF NOT EXISTS last_import_summary jsonb;
