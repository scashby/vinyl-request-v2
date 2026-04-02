BEGIN;

-- Table to store immutable call-order crates per session round.
-- Each crate captures the full call order at generation time so hosts
-- can switch between multiple crates (e.g. if the wrong one was loaded)
-- without re-pulling from a mutable playlist.
CREATE TABLE IF NOT EXISTS public.bingo_session_crates (
  id            bigserial PRIMARY KEY,
  session_id    bigint  NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  round_number  integer NOT NULL,
  crate_name    text    NOT NULL,           -- e.g. "12345 Crate A"
  crate_letter  text    NOT NULL,           -- e.g. "A" (used for ordering/display)
  call_order    jsonb   NOT NULL,           -- array of call rows in draw order
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_session_crates_round_chk    CHECK (round_number >= 1),
  CONSTRAINT bingo_session_crates_letter_chk   CHECK (crate_letter ~ '^[A-Z]$'),
  CONSTRAINT bingo_session_crates_unique       UNIQUE (session_id, round_number, crate_letter)
);

CREATE INDEX IF NOT EXISTS idx_bingo_session_crates_session_round
  ON public.bingo_session_crates(session_id, round_number);

-- Allow sessions to track which crate letter is currently active per round.
-- Stored as jsonb array: [{ round: 1, letter: "A" }, ...]
ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS active_crate_letter_by_round jsonb;

-- Extend the bingo_overlay constraint to include 'countdown' and 'tiebreaker'.
ALTER TABLE public.bingo_sessions
  DROP CONSTRAINT IF EXISTS bingo_sessions_bingo_overlay_chk;

ALTER TABLE public.bingo_sessions
  ADD CONSTRAINT bingo_sessions_bingo_overlay_chk
    CHECK (bingo_overlay IN ('none', 'welcome', 'pending', 'winner', 'thanks', 'countdown', 'tiebreaker'));

COMMIT;
