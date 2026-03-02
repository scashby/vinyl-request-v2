BEGIN;

CREATE TABLE IF NOT EXISTS public.aa_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  stage_one_points integer NOT NULL DEFAULT 3,
  stage_two_points integer NOT NULL DEFAULT 2,
  final_reveal_points integer NOT NULL DEFAULT 1,
  audio_clue_enabled boolean NOT NULL DEFAULT true,
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
  show_stage_hint boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT aa_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT aa_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 14),
  CONSTRAINT aa_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0),
  CONSTRAINT aa_sessions_stage_one_points_chk CHECK (stage_one_points BETWEEN 0 AND 5),
  CONSTRAINT aa_sessions_stage_two_points_chk CHECK (stage_two_points BETWEEN 0 AND 5),
  CONSTRAINT aa_sessions_final_reveal_points_chk CHECK (final_reveal_points BETWEEN 0 AND 5)
);

ALTER TABLE public.aa_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.aa_sessions
  DROP CONSTRAINT IF EXISTS aa_sessions_playlist_id_fkey;
ALTER TABLE public.aa_sessions
  ADD CONSTRAINT aa_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.aa_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.aa_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aa_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.aa_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.aa_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aa_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT aa_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.aa_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.aa_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist_name text NOT NULL,
  accepted_aliases text[] NOT NULL DEFAULT '{}',
  clue_era text NOT NULL,
  clue_collaborator text NOT NULL,
  clue_label_region text NOT NULL,
  audio_clue_source text,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  stage_revealed integer NOT NULL DEFAULT 0,
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aa_session_calls_status_chk CHECK (status IN ('pending', 'stage_1', 'stage_2', 'final_reveal', 'scored', 'skipped')),
  CONSTRAINT aa_session_calls_unique_call UNIQUE (session_id, call_index),
  CONSTRAINT aa_session_calls_stage_revealed_chk CHECK (stage_revealed BETWEEN 0 AND 3)
);

CREATE TABLE IF NOT EXISTS public.aa_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.aa_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.aa_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.aa_session_calls(id) ON DELETE CASCADE,
  guessed_artist text,
  guessed_at_stage integer,
  used_audio_clue boolean NOT NULL DEFAULT false,
  exact_match boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aa_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT aa_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 5),
  CONSTRAINT aa_team_scores_stage_chk CHECK (guessed_at_stage IS NULL OR guessed_at_stage BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS public.aa_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.aa_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aa_sessions_event_id ON public.aa_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_aa_sessions_playlist_id ON public.aa_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_aa_sessions_status ON public.aa_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_teams_session_id ON public.aa_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_aa_rounds_session_id ON public.aa_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_aa_calls_session_id ON public.aa_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_aa_calls_status ON public.aa_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_aa_scores_session_id ON public.aa_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_aa_scores_call_id ON public.aa_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_aa_events_session_id ON public.aa_session_events(session_id);

COMMIT;
