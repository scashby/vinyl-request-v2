BEGIN;

CREATE TABLE IF NOT EXISTS public.sd_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 8,
  points_correct_pair integer NOT NULL DEFAULT 2,
  bonus_both_artists_points integer NOT NULL DEFAULT 1,
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
  CONSTRAINT sd_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT sd_sessions_round_count_chk CHECK (round_count BETWEEN 6 AND 10),
  CONSTRAINT sd_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT sd_sessions_points_correct_pair_chk CHECK (points_correct_pair BETWEEN 0 AND 5),
  CONSTRAINT sd_sessions_bonus_both_artists_points_chk CHECK (bonus_both_artists_points BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS public.sd_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.sd_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sd_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.sd_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.sd_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sd_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT sd_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.sd_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.sd_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  sampled_artist text NOT NULL,
  sampled_title text NOT NULL,
  source_artist text NOT NULL,
  source_title text NOT NULL,
  release_year integer,
  sample_timestamp text,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sd_session_calls_status_chk CHECK (status IN ('pending', 'asked', 'revealed', 'scored', 'skipped')),
  CONSTRAINT sd_session_calls_unique_call UNIQUE (session_id, call_index)
);

CREATE TABLE IF NOT EXISTS public.sd_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.sd_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.sd_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.sd_session_calls(id) ON DELETE CASCADE,
  guessed_sampled_artist text,
  guessed_sampled_title text,
  guessed_source_artist text,
  guessed_source_title text,
  pair_correct boolean NOT NULL DEFAULT false,
  both_artists_named boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sd_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT sd_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS public.sd_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.sd_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_sessions_event_id ON public.sd_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_sd_sessions_status ON public.sd_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_teams_session_id ON public.sd_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_sd_rounds_session_id ON public.sd_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_sd_calls_session_id ON public.sd_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_sd_calls_status ON public.sd_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_sd_scores_session_id ON public.sd_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_sd_scores_call_id ON public.sd_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_sd_events_session_id ON public.sd_session_events(session_id);

COMMIT;
