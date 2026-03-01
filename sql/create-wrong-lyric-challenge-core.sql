BEGIN;

CREATE TABLE IF NOT EXISTS public.wlc_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 10,
  lyric_points integer NOT NULL DEFAULT 2,
  song_bonus_enabled boolean NOT NULL DEFAULT true,
  song_bonus_points integer NOT NULL DEFAULT 1,
  option_count integer NOT NULL DEFAULT 3,
  reveal_mode text NOT NULL DEFAULT 'host_reads',
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
  show_options boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT wlc_sessions_reveal_mode_chk CHECK (reveal_mode IN ('host_reads', 'jumbotron_choices')),
  CONSTRAINT wlc_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT wlc_sessions_round_count_chk CHECK (round_count BETWEEN 8 AND 14),
  CONSTRAINT wlc_sessions_lyric_points_chk CHECK (lyric_points BETWEEN 0 AND 5),
  CONSTRAINT wlc_sessions_song_bonus_points_chk CHECK (song_bonus_points BETWEEN 0 AND 3),
  CONSTRAINT wlc_sessions_option_count_chk CHECK (option_count BETWEEN 3 AND 4),
  CONSTRAINT wlc_sessions_paused_remaining_seconds_chk CHECK (
    paused_remaining_seconds IS NULL OR paused_remaining_seconds >= 0
  ),
  CONSTRAINT wlc_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

-- Backfill/upgrade for existing installs that ran an older version of this script
-- (CREATE TABLE IF NOT EXISTS won't add new columns).
ALTER TABLE public.wlc_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint,
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.wlc_sessions
  DROP CONSTRAINT IF EXISTS wlc_sessions_playlist_id_fkey;

ALTER TABLE public.wlc_sessions
  ALTER COLUMN playlist_id DROP NOT NULL;

ALTER TABLE public.wlc_sessions
  ADD CONSTRAINT wlc_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.wlc_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.wlc_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wlc_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.wlc_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.wlc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_title text,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wlc_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT wlc_session_rounds_unique_round UNIQUE (session_id, round_number)
);

CREATE TABLE IF NOT EXISTS public.wlc_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.wlc_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  source_label text,
  artist text NOT NULL,
  title text NOT NULL,
  correct_lyric text NOT NULL,
  decoy_lyric_1 text NOT NULL,
  decoy_lyric_2 text NOT NULL,
  decoy_lyric_3 text,
  answer_slot integer NOT NULL DEFAULT 1,
  dj_cue_hint text,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wlc_session_calls_status_chk CHECK (status IN ('pending', 'asked', 'locked', 'revealed', 'scored', 'skipped')),
  CONSTRAINT wlc_session_calls_unique_call UNIQUE (session_id, call_index),
  CONSTRAINT wlc_session_calls_answer_slot_chk CHECK (answer_slot BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS public.wlc_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.wlc_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.wlc_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.wlc_session_calls(id) ON DELETE CASCADE,
  guessed_option integer,
  guessed_artist text,
  guessed_title text,
  lyric_correct boolean NOT NULL DEFAULT false,
  song_bonus_awarded boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wlc_team_scores_unique_entry UNIQUE (session_id, team_id, call_id),
  CONSTRAINT wlc_team_scores_points_chk CHECK (awarded_points BETWEEN 0 AND 5),
  CONSTRAINT wlc_team_scores_guessed_option_chk CHECK (guessed_option IS NULL OR guessed_option BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS public.wlc_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.wlc_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wlc_sessions_event_id ON public.wlc_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_wlc_sessions_playlist_id ON public.wlc_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_wlc_sessions_status ON public.wlc_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wlc_teams_session_id ON public.wlc_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_wlc_rounds_session_id ON public.wlc_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_wlc_calls_session_id ON public.wlc_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_wlc_calls_status ON public.wlc_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_wlc_scores_session_id ON public.wlc_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_wlc_scores_call_id ON public.wlc_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_wlc_events_session_id ON public.wlc_session_events(session_id);

COMMIT;
