ALTER TABLE public.collection_playlist_items
  ADD COLUMN IF NOT EXISTS display_artist text;
