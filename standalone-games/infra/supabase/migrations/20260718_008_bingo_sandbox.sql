BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sandbox_source_session_id uuid REFERENCES public.sg_game_bingo_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sandbox_expires_at timestamptz;

COMMIT;
