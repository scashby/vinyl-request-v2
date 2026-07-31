-- Fixed Crates mode: each round uses genuinely different songs, so each round needs
-- its own independently-generated card set (not a relabeled copy of one shared set).
-- This table holds one row per card per round, keyed by ball_number (not call_id,
-- since only the currently-active round's rows exist in bingo_session_calls at any
-- time). At round activation, the matching rows get copied into bingo_cards
-- (translating ball_number -> that round's live call_id) so every existing
-- live-game screen (host/jumbotron/validate) keeps reading bingo_cards unchanged.
-- Purely additive: unused by Shared Pool sessions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.bingo_session_round_cards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  card_number integer NOT NULL CHECK (card_number >= 1),
  card_identifier text NOT NULL,
  has_free_space boolean NOT NULL DEFAULT true,
  grid jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_session_round_cards_unique UNIQUE (session_id, round_number, card_number)
);

CREATE INDEX IF NOT EXISTS idx_bingo_session_round_cards_session_round
  ON public.bingo_session_round_cards(session_id, round_number, card_number);

COMMIT;
