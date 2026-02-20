BEGIN;

CREATE TABLE IF NOT EXISTS public.ntt_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  lock_in_rule text NOT NULL DEFAULT 'time_window',
  lock_in_window_seconds integer NOT NULL DEFAULT 20,
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 8,
  target_gap_seconds integer NOT NULL DEFAULT 52,
  current_round integer NOT NULL DEFAULT 1,
  current_call_index integer NOT NULL DEFAULT 0,
  countdown_started_at timestamptz,
  paused_remaining_seconds integer,
  paused_at timestamptz,
  show_title boolean NOT NULL DEFAULT true,
  show_rounds boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT ntt_sessions_lock_in_rule_chk CHECK (
    lock_in_rule IN ('time_window', 'first_sheet_wins', 'hand_raise')
  ),
  CONSTRAINT ntt_sessions_status_chk CHECK (
    status IN ('pending', 'running', 'paused', 'completed')
  ),
  CONSTRAINT ntt_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 15),
  CONSTRAINT ntt_sessions_lock_in_window_seconds_chk CHECK (lock_in_window_seconds >= 5),
  CONSTRAINT ntt_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

CREATE TABLE IF NOT EXISTS public.ntt_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ntt_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ntt_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.ntt_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ntt_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist_answer text NOT NULL,
  title_answer text NOT NULL,
  accepted_artist_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_title_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  snippet_start_seconds integer NOT NULL DEFAULT 0,
  snippet_duration_seconds integer NOT NULL DEFAULT 8,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  answer_revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ntt_session_calls_status_chk CHECK (
    status IN ('pending', 'asked', 'locked', 'answer_revealed', 'scored', 'skipped')
  ),
  CONSTRAINT ntt_session_calls_unique_call_index UNIQUE (session_id, call_index),
  CONSTRAINT ntt_session_calls_duration_chk CHECK (snippet_duration_seconds BETWEEN 3 AND 20)
);

CREATE TABLE IF NOT EXISTS public.ntt_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ntt_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.ntt_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.ntt_session_calls(id) ON DELETE CASCADE,
  artist_correct boolean NOT NULL DEFAULT false,
  title_correct boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ntt_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT ntt_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 2)
);

CREATE TABLE IF NOT EXISTS public.ntt_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ntt_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ntt_sessions_event_id ON public.ntt_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_ntt_sessions_status ON public.ntt_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ntt_calls_session_id ON public.ntt_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_ntt_calls_status ON public.ntt_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_ntt_teams_session_id ON public.ntt_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_ntt_scores_session_id ON public.ntt_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_ntt_scores_call_id ON public.ntt_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_ntt_events_session_id ON public.ntt_session_events(session_id);

COMMIT;
