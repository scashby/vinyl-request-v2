BEGIN;

CREATE TABLE IF NOT EXISTS public.lgr_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  judge_mode text NOT NULL DEFAULT 'official_key',
  close_match_policy text NOT NULL DEFAULT 'host_discretion',
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 10,
  target_gap_seconds integer NOT NULL DEFAULT 54,
  current_round integer NOT NULL DEFAULT 1,
  current_call_index integer NOT NULL DEFAULT 0,
  countdown_started_at timestamptz,
  paused_remaining_seconds integer,
  paused_at timestamptz,
  show_title boolean NOT NULL DEFAULT true,
  show_round boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  show_answer_mode boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT lgr_sessions_judge_mode_chk CHECK (judge_mode IN ('official_key', 'crowd_check')),
  CONSTRAINT lgr_sessions_close_match_policy_chk CHECK (close_match_policy IN ('host_discretion', 'strict_key')),
  CONSTRAINT lgr_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT lgr_sessions_round_count_chk CHECK (round_count BETWEEN 10 AND 15),
  CONSTRAINT lgr_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

ALTER TABLE public.lgr_sessions
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz;
ALTER TABLE public.lgr_sessions
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer;
ALTER TABLE public.lgr_sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE TABLE IF NOT EXISTS public.lgr_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lgr_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.lgr_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lgr_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT lgr_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.lgr_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist text NOT NULL,
  title text NOT NULL,
  cue_lyric text NOT NULL,
  answer_lyric text NOT NULL,
  accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  answer_revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lgr_session_calls_status_chk CHECK (status IN ('pending', 'asked', 'locked', 'answer_revealed', 'scored', 'skipped')),
  CONSTRAINT lgr_session_calls_unique_call UNIQUE (session_id, call_index)
);

CREATE TABLE IF NOT EXISTS public.lgr_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.lgr_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.lgr_session_calls(id) ON DELETE CASCADE,
  exact_match boolean NOT NULL DEFAULT false,
  close_match boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lgr_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT lgr_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 2)
);

CREATE TABLE IF NOT EXISTS public.lgr_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgr_sessions_event_id ON public.lgr_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_lgr_sessions_status ON public.lgr_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgr_teams_session_id ON public.lgr_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_lgr_rounds_session_id ON public.lgr_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_lgr_calls_session_id ON public.lgr_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_lgr_calls_status ON public.lgr_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_lgr_scores_session_id ON public.lgr_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_lgr_scores_call_id ON public.lgr_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_lgr_events_session_id ON public.lgr_session_events(session_id);

COMMIT;
