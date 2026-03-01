BEGIN;

CREATE TABLE IF NOT EXISTS public.ooc_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  points_correct_call integer NOT NULL DEFAULT 2,
  bonus_original_artist_points integer NOT NULL DEFAULT 1,
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 10,
  target_gap_seconds integer NOT NULL DEFAULT 54,
  current_round integer NOT NULL DEFAULT 1,
  countdown_started_at timestamptz,
  paused_remaining_seconds integer,
  paused_at timestamptz,
  current_call_index integer NOT NULL DEFAULT 0,
  show_title boolean NOT NULL DEFAULT true,
  show_round boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  show_prompt boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT ooc_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT ooc_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 12),
  CONSTRAINT ooc_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT ooc_sessions_points_correct_call_chk CHECK (points_correct_call BETWEEN 0 AND 5),
  CONSTRAINT ooc_sessions_bonus_original_artist_points_chk CHECK (bonus_original_artist_points BETWEEN 0 AND 3)
);

ALTER TABLE public.ooc_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint,
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.ooc_sessions
  DROP CONSTRAINT IF EXISTS ooc_sessions_playlist_id_fkey;

ALTER TABLE public.ooc_sessions
  ADD CONSTRAINT ooc_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ooc_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ooc_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ooc_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.ooc_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ooc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ooc_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT ooc_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.ooc_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ooc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  spin_artist text NOT NULL,
  track_title text NOT NULL,
  original_artist text NOT NULL,
  alt_accept_original_artist text,
  release_year integer,
  is_cover boolean NOT NULL,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ooc_session_calls_status_chk CHECK (status IN ('pending', 'asked', 'revealed', 'scored', 'skipped')),
  CONSTRAINT ooc_session_calls_unique_call UNIQUE (session_id, call_index)
);

CREATE TABLE IF NOT EXISTS public.ooc_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ooc_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.ooc_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.ooc_session_calls(id) ON DELETE CASCADE,
  called_original boolean,
  named_original_artist text,
  call_correct boolean NOT NULL DEFAULT false,
  artist_bonus_awarded boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ooc_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT ooc_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS public.ooc_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ooc_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ooc_sessions_event_id ON public.ooc_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_ooc_sessions_playlist_id ON public.ooc_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_ooc_sessions_status ON public.ooc_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ooc_teams_session_id ON public.ooc_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_ooc_rounds_session_id ON public.ooc_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_ooc_calls_session_id ON public.ooc_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_ooc_calls_status ON public.ooc_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_ooc_scores_session_id ON public.ooc_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_ooc_scores_call_id ON public.ooc_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_ooc_events_session_id ON public.ooc_session_events(session_id);

COMMIT;
