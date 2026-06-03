-- Add theme support to bingo sessions and playlist items.
-- Theme enables a "theme hint" reveal phase on the jumbotron between the
-- column reveal and the artist reveal.

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS theme_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme_name text;

ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS theme_hint text;

ALTER TABLE public.bingo_session_round_tracks
  ADD COLUMN IF NOT EXISTS theme_hint text;

ALTER TABLE public.bingo_session_calls
  ADD COLUMN IF NOT EXISTS theme_hint text;
