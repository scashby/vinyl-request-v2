BEGIN;

ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.trivia_sessions
  DROP CONSTRAINT IF EXISTS trivia_sessions_playlist_id_fkey;
ALTER TABLE public.trivia_sessions
  ADD CONSTRAINT trivia_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS tie_breaker_count integer NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_sessions_tie_breaker_count_chk'
  ) THEN
    ALTER TABLE public.trivia_sessions
      ADD CONSTRAINT trivia_sessions_tie_breaker_count_chk CHECK (tie_breaker_count >= 0);
  END IF;
END $$;

ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS playlist_track_key text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS is_tiebreaker boolean NOT NULL DEFAULT false;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS prep_status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS display_element_type text NOT NULL DEFAULT 'song';
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS display_image_override_url text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS auto_cover_art_url text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS auto_vinyl_label_url text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS source_artist text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS source_title text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS source_album text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS source_side text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS source_position text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_session_calls_prep_status_chk'
  ) THEN
    ALTER TABLE public.trivia_session_calls
      ADD CONSTRAINT trivia_session_calls_prep_status_chk
      CHECK (prep_status IN ('draft', 'ready'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_session_calls_display_element_type_chk'
  ) THEN
    ALTER TABLE public.trivia_session_calls
      ADD CONSTRAINT trivia_session_calls_display_element_type_chk
      CHECK (display_element_type IN ('song', 'artist', 'album', 'cover_art', 'vinyl_label'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trivia_sessions_playlist_id ON public.trivia_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_tiebreaker ON public.trivia_session_calls(session_id, is_tiebreaker, call_index);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_prep_status ON public.trivia_session_calls(session_id, prep_status);

COMMIT;
