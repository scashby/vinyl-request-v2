-- Add default_intermission_seconds to bingo_sessions so that the preset
-- intermission duration configured at session-creation time is stored and
-- read back by the host page as its initial intermission length.

BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS default_intermission_seconds integer NOT NULL DEFAULT 180;

COMMIT;
