-- Add link_group column to support linked track pairs in bingo
-- Tracks sharing the same non-null link_group value are a linked pair:
-- they are placed in the same bingo column and cannot appear on the same card.

ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS link_group text;

ALTER TABLE public.bingo_session_round_tracks
  ADD COLUMN IF NOT EXISTS link_group text;

ALTER TABLE public.bingo_session_calls
  ADD COLUMN IF NOT EXISTS link_group text;
