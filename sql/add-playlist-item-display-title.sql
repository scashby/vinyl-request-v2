-- Per-playlist display title override for collection_playlist_items
-- Allows a track's title to be shown differently in a specific playlist
-- without changing the underlying release_tracks.title_override globally.
-- Priority: display_title > title_override > recording.title

ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS display_title text;
