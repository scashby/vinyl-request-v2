BEGIN;

CREATE TABLE IF NOT EXISTS public.ndr_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL, 
  round_count integer NOT NULL DEFAULT 10,
  answer_mode text NOT NULL DEFAULT 'slips',
  snippet_seconds integer NOT NULL DEFAULT 7,
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
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT ndr_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 12),
  CONSTRAINT ndr_sessions_answer_mode_chk CHECK (answer_mode IN ('slips', 'whiteboard', 'mixed')),
  CONSTRAINT ndr_sessions_snippet_seconds_chk CHECK (snippet_seconds BETWEEN 5 AND 10),
  CONSTRAINT ndr_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT ndr_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.ndr_sessions
  DROP CONSTRAINT IF EXISTS ndr_sessions_playlist_id_fkey;
ALTER TABLE public.ndr_sessions
  ADD CONSTRAINT ndr_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ndr_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ndr_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ndr_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.ndr_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ndr_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_name text NOT NULL,
  expected_calls integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ndr_session_rounds_unique_round UNIQUE (session_id, round_number),
  CONSTRAINT ndr_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT ndr_session_rounds_expected_calls_chk CHECK (expected_calls > 0)
);

CREATE TABLE IF NOT EXISTS public.ndr_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ndr_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist_answer text NOT NULL,
  title_answer text NOT NULL,
  accepted_artist_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_title_aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  snippet_start_seconds integer NOT NULL DEFAULT 0,
  snippet_duration_seconds integer NOT NULL DEFAULT 7,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  answer_revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ndr_session_calls_unique_call_index UNIQUE (session_id, call_index),
  CONSTRAINT ndr_session_calls_status_chk CHECK (
    status IN ('pending', 'asked', 'locked', 'answer_revealed', 'scored', 'skipped')
  ),
  CONSTRAINT ndr_session_calls_duration_chk CHECK (snippet_duration_seconds BETWEEN 5 AND 10)
);

CREATE TABLE IF NOT EXISTS public.ndr_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ndr_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.ndr_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.ndr_session_calls(id) ON DELETE CASCADE,
  artist_correct boolean NOT NULL DEFAULT false,
  title_correct boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ndr_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT ndr_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 2)
);

CREATE TABLE IF NOT EXISTS public.ndr_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.ndr_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndr_sessions_event_id ON public.ndr_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_ndr_sessions_playlist_id ON public.ndr_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_ndr_sessions_status ON public.ndr_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndr_teams_session_id ON public.ndr_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_ndr_rounds_session_id ON public.ndr_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_ndr_calls_session_id ON public.ndr_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_ndr_calls_status ON public.ndr_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_ndr_scores_session_id ON public.ndr_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_ndr_scores_call_id ON public.ndr_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_ndr_events_session_id ON public.ndr_session_events(session_id);

COMMIT;
