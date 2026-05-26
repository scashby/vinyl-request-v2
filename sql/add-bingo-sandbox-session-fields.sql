-- Sandbox session support for Music Bingo dry runs.
-- Safe to re-run; uses IF NOT EXISTS checks.

BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_source_session_id bigint REFERENCES public.bingo_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sandbox_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bingo_sessions_is_sandbox ON public.bingo_sessions(is_sandbox);
CREATE INDEX IF NOT EXISTS idx_bingo_sessions_sandbox_expires_at ON public.bingo_sessions(sandbox_expires_at);
CREATE INDEX IF NOT EXISTS idx_bingo_sessions_sandbox_source ON public.bingo_sessions(sandbox_source_session_id);

COMMIT;
