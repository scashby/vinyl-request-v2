BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS bingo_overlay text NOT NULL DEFAULT 'welcome',
  ADD COLUMN IF NOT EXISTS next_game_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer;

COMMIT;
