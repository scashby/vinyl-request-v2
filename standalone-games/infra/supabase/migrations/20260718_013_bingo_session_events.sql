BEGIN;

CREATE TABLE IF NOT EXISTS public.sg_game_bingo_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sg_game_bingo_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_game_bingo_session_events_event_type_chk
    CHECK (event_type IN ('cue_set', 'pull_set', 'pull_promote', 'call_set'))
);

CREATE INDEX IF NOT EXISTS idx_sg_bingo_session_events_session
  ON public.sg_game_bingo_session_events(session_id, created_at, id);

ALTER TABLE public.sg_game_bingo_session_events ENABLE ROW LEVEL SECURITY;

COMMIT;
