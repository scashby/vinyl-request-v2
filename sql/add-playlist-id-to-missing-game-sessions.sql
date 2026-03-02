BEGIN;

ALTER TABLE public.aa_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.aa_sessions
  DROP CONSTRAINT IF EXISTS aa_sessions_playlist_id_fkey;
ALTER TABLE public.aa_sessions
  ADD CONSTRAINT aa_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_aa_sessions_playlist_id ON public.aa_sessions(playlist_id);

ALTER TABLE public.dd_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.dd_sessions
  DROP CONSTRAINT IF EXISTS dd_sessions_playlist_id_fkey;
ALTER TABLE public.dd_sessions
  ADD CONSTRAINT dd_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dd_sessions_playlist_id ON public.dd_sessions(playlist_id);

ALTER TABLE public.lgr_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.lgr_sessions
  DROP CONSTRAINT IF EXISTS lgr_sessions_playlist_id_fkey;
ALTER TABLE public.lgr_sessions
  ADD CONSTRAINT lgr_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lgr_sessions_playlist_id ON public.lgr_sessions(playlist_id);

ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.ndr_sessions
  DROP CONSTRAINT IF EXISTS ndr_sessions_playlist_id_fkey;
ALTER TABLE public.ndr_sessions
  ADD CONSTRAINT ndr_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ndr_sessions_playlist_id ON public.ndr_sessions(playlist_id);

ALTER TABLE public.bb_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.bb_sessions
  DROP CONSTRAINT IF EXISTS bb_sessions_playlist_id_fkey;
ALTER TABLE public.bb_sessions
  ADD CONSTRAINT bb_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bb_sessions_playlist_id ON public.bb_sessions(playlist_id);

COMMIT;
