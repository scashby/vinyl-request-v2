BEGIN;

CREATE TABLE IF NOT EXISTS public.dd_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 14,
  adjacent_scoring_enabled boolean NOT NULL DEFAULT true,
  exact_points integer NOT NULL DEFAULT 2,
  adjacent_points integer NOT NULL DEFAULT 1,
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 10,
  target_gap_seconds integer NOT NULL DEFAULT 54,
  current_round integer NOT NULL DEFAULT 1,
  current_call_index integer NOT NULL DEFAULT 0,
  show_title boolean NOT NULL DEFAULT true,
  show_round boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  show_scoring_hint boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT dd_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT dd_sessions_round_count_chk CHECK (round_count BETWEEN 12 AND 20),
  CONSTRAINT dd_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT dd_sessions_exact_points_chk CHECK (exact_points BETWEEN 0 AND 3),
  CONSTRAINT dd_sessions_adjacent_points_chk CHECK (adjacent_points BETWEEN 0 AND 2)
);

CREATE TABLE IF NOT EXISTS public.dd_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.dd_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.dd_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.dd_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT dd_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.dd_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.dd_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist text,
  title text,
  release_year integer,
  decade_start integer NOT NULL,
  accepted_adjacent_decades jsonb NOT NULL DEFAULT '[]'::jsonb,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_session_calls_status_chk CHECK (status IN ('pending', 'asked', 'locked', 'revealed', 'scored', 'skipped')),
  CONSTRAINT dd_session_calls_unique_call UNIQUE (session_id, call_index),
  CONSTRAINT dd_session_calls_decade_chk CHECK (decade_start BETWEEN 1950 AND 2030 AND decade_start % 10 = 0)
);

CREATE TABLE IF NOT EXISTS public.dd_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.dd_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.dd_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.dd_session_calls(id) ON DELETE CASCADE,
  selected_decade integer,
  exact_match boolean NOT NULL DEFAULT false,
  adjacent_match boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT dd_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 2)
);

CREATE TABLE IF NOT EXISTS public.dd_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.dd_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dd_sessions_event_id ON public.dd_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_dd_sessions_status ON public.dd_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dd_teams_session_id ON public.dd_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_dd_rounds_session_id ON public.dd_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_dd_calls_session_id ON public.dd_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_dd_calls_status ON public.dd_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_scores_session_id ON public.dd_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_dd_scores_call_id ON public.dd_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_dd_events_session_id ON public.dd_session_events(session_id);

COMMIT;
