BEGIN;

-- Ensure NTT sessions can keep playlist lineage for metadata re-sync.
ALTER TABLE public.ntt_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;

ALTER TABLE public.ntt_sessions
  DROP CONSTRAINT IF EXISTS ntt_sessions_playlist_id_fkey;

ALTER TABLE public.ntt_sessions
  ADD CONSTRAINT ntt_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

ALTER TABLE public.ntt_session_calls
  ADD COLUMN IF NOT EXISTS playlist_track_key text,
  ADD COLUMN IF NOT EXISTS metadata_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_synced_at timestamptz;

ALTER TABLE public.gi_session_calls
  ADD COLUMN IF NOT EXISTS playlist_track_key text,
  ADD COLUMN IF NOT EXISTS metadata_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_synced_at timestamptz;

ALTER TABLE public.bingo_session_calls
  ADD COLUMN IF NOT EXISTS metadata_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_synced_at timestamptz;

ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS metadata_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ntt_sessions_playlist_id ON public.ntt_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_ntt_calls_track_key ON public.ntt_session_calls(session_id, playlist_track_key);
CREATE INDEX IF NOT EXISTS idx_ntt_calls_metadata_sync ON public.ntt_session_calls(session_id, metadata_locked, metadata_synced_at);

CREATE INDEX IF NOT EXISTS idx_gi_calls_track_key ON public.gi_session_calls(session_id, playlist_track_key);
CREATE INDEX IF NOT EXISTS idx_gi_calls_metadata_sync ON public.gi_session_calls(session_id, metadata_locked, metadata_synced_at);

CREATE INDEX IF NOT EXISTS idx_bingo_calls_metadata_sync ON public.bingo_session_calls(session_id, metadata_locked, metadata_synced_at);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_metadata_sync ON public.trivia_session_calls(session_id, metadata_locked, metadata_synced_at);

COMMIT;
