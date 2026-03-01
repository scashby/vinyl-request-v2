BEGIN;

CREATE TABLE IF NOT EXISTS public.ccat_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 4,
  default_tracks_per_round integer NOT NULL DEFAULT 4,
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 12,
  target_gap_seconds integer NOT NULL DEFAULT 56,
  current_round integer NOT NULL DEFAULT 1,
  current_call_index integer NOT NULL DEFAULT 0,
  countdown_started_at timestamptz,
  paused_remaining_seconds integer,
  paused_at timestamptz,
  show_title boolean NOT NULL DEFAULT true,
  show_round boolean NOT NULL DEFAULT true,
  show_prompt boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT ccat_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT ccat_sessions_round_count_chk CHECK (round_count BETWEEN 3 AND 8),
  CONSTRAINT ccat_sessions_tracks_chk CHECK (default_tracks_per_round BETWEEN 3 AND 5),
  CONSTRAINT ccat_sessions_gap_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT ccat_sessions_paused_remaining_chk CHECK (paused_remaining_seconds IS NULL OR paused_remaining_seconds >= 0)
);

ALTER TABLE public.ccat_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ccat_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ccat_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccat_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.ccat_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ccat_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  category_label text NOT NULL,
  prompt_type text NOT NULL,
  tracks_in_round integer NOT NULL DEFAULT 4,
  points_correct integer NOT NULL DEFAULT 2,
  points_bonus integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccat_rounds_unique_round UNIQUE (session_id, round_number),
  CONSTRAINT ccat_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT ccat_rounds_prompt_chk CHECK (prompt_type IN ('identify-thread', 'odd-one-out', 'belongs-or-bust', 'decade-lock', 'mood-match')),
  CONSTRAINT ccat_rounds_tracks_chk CHECK (tracks_in_round BETWEEN 3 AND 5),
  CONSTRAINT ccat_rounds_points_correct_chk CHECK (points_correct BETWEEN 0 AND 5),
  CONSTRAINT ccat_rounds_points_bonus_chk CHECK (points_bonus BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS public.ccat_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ccat_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  track_in_round integer NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  release_year integer,
  source_label text,
  crate_tag text,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccat_calls_unique_call UNIQUE (session_id, call_index),
  CONSTRAINT ccat_calls_unique_track_slot UNIQUE (session_id, round_number, track_in_round),
  CONSTRAINT ccat_calls_status_chk CHECK (status IN ('pending', 'playing', 'revealed', 'scored', 'skipped')),
  CONSTRAINT ccat_calls_track_slot_chk CHECK (track_in_round BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS public.ccat_round_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ccat_sessions(id) ON DELETE CASCADE,
  round_id bigint NOT NULL REFERENCES public.ccat_session_rounds(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.ccat_session_teams(id) ON DELETE CASCADE,
  guess_summary text,
  rationale text,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ccat_round_scores_unique_entry UNIQUE (session_id, round_id, team_id),
  CONSTRAINT ccat_round_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 5)
);

CREATE TABLE IF NOT EXISTS public.ccat_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ccat_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccat_sessions_event_id ON public.ccat_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_ccat_sessions_playlist_id ON public.ccat_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_ccat_sessions_status ON public.ccat_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ccat_teams_session_id ON public.ccat_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_ccat_rounds_session_id ON public.ccat_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_ccat_rounds_prompt_type ON public.ccat_session_rounds(session_id, prompt_type);
CREATE INDEX IF NOT EXISTS idx_ccat_calls_session_id ON public.ccat_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_ccat_calls_round_number ON public.ccat_session_calls(session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_ccat_scores_session_id ON public.ccat_round_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_ccat_events_session_id ON public.ccat_session_events(session_id);

COMMIT;
