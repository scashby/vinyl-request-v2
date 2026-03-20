-- Post-dry-run improvements: Phase 1 schema additions for bingo_sessions
-- Safe to re-run; uses ADD COLUMN IF NOT EXISTS throughout.

BEGIN;

-- Scheduled next-game countdown and rules display on jumbotron
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS next_game_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_game_rules_text text;

-- Adjustable delay (seconds) between host pressing "Call" and jumbotron revealing the call.
-- Default: 3 seconds — enough time to step from laptop to mixer.
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS call_reveal_delay_seconds integer NOT NULL DEFAULT 3;

-- Timestamp set on each call trigger indicating when the jumbotron should reveal the call.
-- Cleared (set to null) when a new call is triggered and recalculated.
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS call_reveal_at timestamptz;

-- Jumbotron overlay state — controls "Bingo Pending" and "Bingo Winner" overlays.
-- Does NOT change the core session status; purely a display flag.
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS bingo_overlay text NOT NULL DEFAULT 'none';

-- Add CHECK constraint separately so it's safe to re-run on existing installs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bingo_sessions_bingo_overlay_chk'
  ) THEN
    ALTER TABLE public.bingo_sessions
      ADD CONSTRAINT bingo_sessions_bingo_overlay_chk
      CHECK (bingo_overlay IN ('none', 'pending', 'winner'));
  END IF;
END
$$;

COMMIT;
