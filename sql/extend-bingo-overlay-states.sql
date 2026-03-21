-- Extend bingo_overlay check constraint to support welcome and thanks screens.
-- The 'welcome' overlay shows the pre-game welcome screen on the jumbotron.
-- The 'thanks' overlay shows the Thank You For Playing screen after End Game.
-- Safe to re-run: uses DROP CONSTRAINT IF EXISTS before re-adding.

BEGIN;

ALTER TABLE public.bingo_sessions
  DROP CONSTRAINT IF EXISTS bingo_sessions_bingo_overlay_chk;

ALTER TABLE public.bingo_sessions
  ADD CONSTRAINT bingo_sessions_bingo_overlay_chk
    CHECK (bingo_overlay IN ('none', 'welcome', 'pending', 'winner', 'thanks'));

COMMIT;
