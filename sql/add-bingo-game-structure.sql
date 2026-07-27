-- Adds an opt-in "game_structure" flag to bingo_sessions distinguishing:
--   'shared_pool'   (default, existing behavior) - one master pool, resorted/reshuffled each round.
--   'fixed_crates'  (new) - each round is assigned its own distinct playlist ("crate"),
--                    printed as its own full card set ahead of time.
-- Purely additive: existing rows default to 'shared_pool', so all current sessions/behavior
-- are unaffected. Safe to re-run.

BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS game_structure text NOT NULL DEFAULT 'shared_pool';

ALTER TABLE public.bingo_sessions
  DROP CONSTRAINT IF EXISTS bingo_sessions_game_structure_chk;

ALTER TABLE public.bingo_sessions
  ADD CONSTRAINT bingo_sessions_game_structure_chk
    CHECK (game_structure IN ('shared_pool', 'fixed_crates'));

COMMIT;
