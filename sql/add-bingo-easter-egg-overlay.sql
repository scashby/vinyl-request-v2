-- Extend bingo_overlay check constraint to support a one-off "easter_egg" overlay.
-- Used only for a single scripted session (gated to session_code = 'BWDA85' in app code)
-- to glitch the jumbotron and cut to a couple of short videos before returning to normal play.
-- Safe to re-run: uses DROP CONSTRAINT IF EXISTS before re-adding.

BEGIN;

ALTER TABLE public.bingo_sessions
  DROP CONSTRAINT IF EXISTS bingo_sessions_bingo_overlay_chk;

ALTER TABLE public.bingo_sessions
  ADD CONSTRAINT bingo_sessions_bingo_overlay_chk
    CHECK (bingo_overlay IN ('none', 'welcome', 'pending', 'winner', 'thanks', 'countdown', 'tiebreaker', 'easter_egg'));

COMMIT;
