-- THIS MIGRATION HAS BEEN ROLLED BACK. Delete this file.
-- Run the following SQL to revert the changes it made:
--
-- ALTER TABLE public.bingo_sessions DROP COLUMN IF EXISTS theme_name;
-- ALTER TABLE public.bingo_session_calls DROP COLUMN IF EXISTS reveal_context;
-- DROP TABLE IF EXISTS public.bingo_theme_contexts;


-- Display label for the session's theme (e.g. "Songs from Movies and TV").
-- When set, the Context Reveals editor uses this to load / save theme presets.
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS theme_name text;

-- Per-call context text shown as a first reveal phase on the jumbotron.
-- When NULL the call uses the existing two-phase reveal (artist → full) unchanged.
ALTER TABLE public.bingo_session_calls
  ADD COLUMN IF NOT EXISTS reveal_context text;

-- Persistent store of context entries keyed by theme_slug + playlist_track_key.
-- Allows a theme's context entries to be loaded into future sessions automatically.
CREATE TABLE IF NOT EXISTS public.bingo_theme_contexts (
  id          bigserial PRIMARY KEY,
  theme_slug  text        NOT NULL,
  theme_name  text        NOT NULL,
  playlist_track_key text NOT NULL,
  context_text text       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (theme_slug, playlist_track_key)
);

-- RLS: open policies — single-owner admin app, no per-user row ownership.
ALTER TABLE public.bingo_theme_contexts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bingo_theme_contexts TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bingo_theme_contexts_id_seq TO anon, authenticated;

CREATE POLICY bingo_theme_contexts_select_all
  ON public.bingo_theme_contexts FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY bingo_theme_contexts_insert_all
  ON public.bingo_theme_contexts FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY bingo_theme_contexts_update_all
  ON public.bingo_theme_contexts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY bingo_theme_contexts_delete_all
  ON public.bingo_theme_contexts FOR DELETE TO anon, authenticated USING (true);

COMMIT;
