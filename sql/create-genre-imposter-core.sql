BEGIN;

CREATE TABLE IF NOT EXISTS public.gi_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 8,
  reveal_mode text NOT NULL DEFAULT 'after_third_spin',
  reason_mode text NOT NULL DEFAULT 'host_judged',
  imposter_points integer NOT NULL DEFAULT 2,
  reason_bonus_points integer NOT NULL DEFAULT 1,
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
  show_category boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT gi_sessions_round_count_chk CHECK (round_count BETWEEN 6 AND 15),
  CONSTRAINT gi_sessions_reveal_mode_chk CHECK (reveal_mode IN ('after_third_spin', 'immediate')),
  CONSTRAINT gi_sessions_reason_mode_chk CHECK (reason_mode IN ('host_judged', 'strict_key')),
  CONSTRAINT gi_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT gi_sessions_imposter_points_chk CHECK (imposter_points BETWEEN 0 AND 5),
  CONSTRAINT gi_sessions_reason_bonus_points_chk CHECK (reason_bonus_points BETWEEN 0 AND 3),
  CONSTRAINT gi_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

ALTER TABLE public.gi_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

ALTER TABLE public.gi_sessions
  ADD COLUMN IF NOT EXISTS countdown_started_at timestamptz;

ALTER TABLE public.gi_sessions
  ADD COLUMN IF NOT EXISTS paused_remaining_seconds integer;

ALTER TABLE public.gi_sessions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

CREATE TABLE IF NOT EXISTS public.gi_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gi_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.gi_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  category_label text NOT NULL,
  category_card_note text,
  reason_key text,
  imposter_call_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gi_session_rounds_unique_round UNIQUE (session_id, round_number),
  CONSTRAINT gi_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT gi_session_rounds_imposter_call_index_chk CHECK (imposter_call_index BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS public.gi_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  round_id bigint NOT NULL REFERENCES public.gi_session_rounds(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  play_order integer NOT NULL,
  source_label text,
  artist text,
  title text,
  record_label text,
  fits_category boolean NOT NULL DEFAULT true,
  is_imposter boolean NOT NULL DEFAULT false,
  host_notes text,
  status text NOT NULL DEFAULT 'pending',
  cued_at timestamptz,
  played_at timestamptz,
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gi_session_calls_unique_round_slot UNIQUE (round_id, call_index),
  CONSTRAINT gi_session_calls_unique_session_index UNIQUE (session_id, round_number, call_index),
  CONSTRAINT gi_session_calls_call_index_chk CHECK (call_index BETWEEN 1 AND 3),
  CONSTRAINT gi_session_calls_play_order_chk CHECK (play_order BETWEEN 1 AND 3),
  CONSTRAINT gi_session_calls_status_chk CHECK (status IN ('pending', 'cued', 'played', 'revealed', 'scored', 'skipped'))
);

CREATE TABLE IF NOT EXISTS public.gi_round_team_picks (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  round_id bigint NOT NULL REFERENCES public.gi_session_rounds(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.gi_session_teams(id) ON DELETE CASCADE,
  picked_call_id bigint NOT NULL REFERENCES public.gi_session_calls(id) ON DELETE CASCADE,
  reason_text text,
  imposter_correct boolean NOT NULL DEFAULT false,
  reason_correct boolean NOT NULL DEFAULT false,
  awarded_points integer NOT NULL DEFAULT 0,
  scored_by text,
  locked_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gi_round_team_picks_unique_pick UNIQUE (round_id, team_id),
  CONSTRAINT gi_round_team_picks_points_chk CHECK (awarded_points BETWEEN 0 AND 8)
);

ALTER TABLE public.gi_round_team_picks
  DROP CONSTRAINT IF EXISTS gi_round_team_picks_points_chk;

ALTER TABLE public.gi_round_team_picks
  ADD CONSTRAINT gi_round_team_picks_points_chk CHECK (awarded_points BETWEEN 0 AND 8);

CREATE TABLE IF NOT EXISTS public.gi_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.gi_session_teams(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  imposter_hits integer NOT NULL DEFAULT 0,
  reason_bonus_hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gi_team_scores_unique_team UNIQUE (session_id, team_id),
  CONSTRAINT gi_team_scores_total_points_chk CHECK (total_points >= 0)
);

CREATE TABLE IF NOT EXISTS public.gi_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.gi_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gi_sessions_event_id ON public.gi_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_gi_sessions_playlist_id ON public.gi_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_gi_sessions_status ON public.gi_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gi_teams_session_id ON public.gi_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_rounds_session_id ON public.gi_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_calls_session_id ON public.gi_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_calls_round_id ON public.gi_session_calls(round_id);
CREATE INDEX IF NOT EXISTS idx_gi_picks_session_id ON public.gi_round_team_picks(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_scores_session_id ON public.gi_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_gi_events_session_id ON public.gi_session_events(session_id);

COMMIT;
