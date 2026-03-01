BEGIN;

CREATE TABLE IF NOT EXISTS public.b2bc_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  connection_points integer NOT NULL DEFAULT 2,
  detail_bonus_points integer NOT NULL DEFAULT 1,
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
  show_connection_prompt boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT b2bc_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT b2bc_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 14),
  CONSTRAINT b2bc_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT b2bc_sessions_connection_points_chk CHECK (connection_points BETWEEN 0 AND 3),
  CONSTRAINT b2bc_sessions_detail_bonus_points_chk CHECK (detail_bonus_points BETWEEN 0 AND 2)
);

ALTER TABLE public.b2bc_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.b2bc_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.b2bc_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2bc_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.b2bc_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.b2bc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2bc_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT b2bc_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.b2bc_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.b2bc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  track_a_artist text NOT NULL,
  track_a_title text NOT NULL,
  track_a_release_year integer,
  track_a_source_label text,
  track_b_artist text NOT NULL,
  track_b_title text NOT NULL,
  track_b_release_year integer,
  track_b_source_label text,
  accepted_connection text NOT NULL,
  accepted_detail text,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2bc_session_calls_status_chk CHECK (status IN ('pending', 'played_track_a', 'played_track_b', 'discussion', 'revealed', 'scored', 'skipped')),
  CONSTRAINT b2bc_session_calls_unique_call UNIQUE (session_id, call_index)
);

CREATE TABLE IF NOT EXISTS public.b2bc_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.b2bc_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.b2bc_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.b2bc_session_calls(id) ON DELETE CASCADE,
  guessed_connection text,
  guessed_detail text,
  connection_correct boolean NOT NULL DEFAULT false,
  detail_correct boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT b2bc_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT b2bc_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS public.b2bc_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.b2bc_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2bc_sessions_event_id ON public.b2bc_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_sessions_playlist_id ON public.b2bc_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_sessions_status ON public.b2bc_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2bc_teams_session_id ON public.b2bc_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_rounds_session_id ON public.b2bc_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_calls_session_id ON public.b2bc_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_calls_status ON public.b2bc_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_b2bc_scores_session_id ON public.b2bc_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_scores_call_id ON public.b2bc_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_b2bc_events_session_id ON public.b2bc_session_events(session_id);

COMMIT;
