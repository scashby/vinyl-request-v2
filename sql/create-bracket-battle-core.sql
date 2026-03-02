BEGIN;

CREATE TABLE IF NOT EXISTS public.bb_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  bracket_size integer NOT NULL DEFAULT 8,
  vote_method text NOT NULL DEFAULT 'hands',
  scoring_model text NOT NULL DEFAULT 'round_weighted',
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  find_record_seconds integer NOT NULL DEFAULT 12,
  cue_seconds integer NOT NULL DEFAULT 12,
  host_buffer_seconds integer NOT NULL DEFAULT 10,
  target_gap_seconds integer NOT NULL DEFAULT 54,
  current_round integer NOT NULL DEFAULT 1,
  current_matchup_index integer NOT NULL DEFAULT 0,
  show_title boolean NOT NULL DEFAULT true,
  show_round boolean NOT NULL DEFAULT true,
  show_bracket boolean NOT NULL DEFAULT true,
  show_scoreboard boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT bb_sessions_bracket_size_chk CHECK (bracket_size IN (4, 8, 16)),
  CONSTRAINT bb_sessions_vote_method_chk CHECK (vote_method IN ('hands', 'slips')),
  CONSTRAINT bb_sessions_scoring_model_chk CHECK (scoring_model IN ('round_weighted', 'flat_per_hit')),
  CONSTRAINT bb_sessions_status_chk CHECK (status IN ('pending', 'running', 'paused', 'completed')),
  CONSTRAINT bb_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

ALTER TABLE public.bb_sessions
  ADD COLUMN IF NOT EXISTS playlist_id bigint;
ALTER TABLE public.bb_sessions
  DROP CONSTRAINT IF EXISTS bb_sessions_playlist_id_fkey;
ALTER TABLE public.bb_sessions
  ADD CONSTRAINT bb_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.bb_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.bb_session_entries (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  seed integer NOT NULL,
  entry_label text NOT NULL,
  artist text,
  title text,
  source_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_session_entries_seed_chk CHECK (seed > 0),
  CONSTRAINT bb_session_entries_unique_seed UNIQUE (session_id, seed)
);

CREATE TABLE IF NOT EXISTS public.bb_session_rounds (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  round_name text NOT NULL,
  expected_matchups integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_session_rounds_unique_round UNIQUE (session_id, round_number),
  CONSTRAINT bb_session_rounds_status_chk CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT bb_session_rounds_expected_matchups_chk CHECK (expected_matchups > 0)
);

CREATE TABLE IF NOT EXISTS public.bb_session_matchups (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  matchup_index integer NOT NULL,
  higher_seed_entry_id bigint REFERENCES public.bb_session_entries(id) ON DELETE SET NULL,
  lower_seed_entry_id bigint REFERENCES public.bb_session_entries(id) ON DELETE SET NULL,
  winner_entry_id bigint REFERENCES public.bb_session_entries(id) ON DELETE SET NULL,
  source_label text,
  vote_method text NOT NULL DEFAULT 'hands',
  status text NOT NULL DEFAULT 'pending',
  opened_at timestamptz,
  voting_locked_at timestamptz,
  winner_confirmed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_session_matchups_unique_index UNIQUE (session_id, round_number, matchup_index),
  CONSTRAINT bb_session_matchups_status_chk CHECK (status IN ('pending', 'active', 'voting_locked', 'scored', 'skipped')),
  CONSTRAINT bb_session_matchups_vote_method_chk CHECK (vote_method IN ('hands', 'slips'))
);

CREATE TABLE IF NOT EXISTS public.bb_matchup_vote_tallies (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  matchup_id bigint NOT NULL REFERENCES public.bb_session_matchups(id) ON DELETE CASCADE,
  winner_entry_id bigint NOT NULL REFERENCES public.bb_session_entries(id) ON DELETE CASCADE,
  vote_count integer NOT NULL DEFAULT 0,
  captured_by text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_matchup_vote_tallies_unique_entry UNIQUE (matchup_id, winner_entry_id),
  CONSTRAINT bb_matchup_vote_tallies_vote_count_chk CHECK (vote_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.bb_bracket_picks (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.bb_session_teams(id) ON DELETE CASCADE,
  matchup_id bigint NOT NULL REFERENCES public.bb_session_matchups(id) ON DELETE CASCADE,
  picked_entry_id bigint NOT NULL REFERENCES public.bb_session_entries(id) ON DELETE CASCADE,
  is_correct boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_bracket_picks_unique_pick UNIQUE (team_id, matchup_id),
  CONSTRAINT bb_bracket_picks_points_awarded_chk CHECK (points_awarded >= 0)
);

CREATE TABLE IF NOT EXISTS public.bb_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.bb_session_teams(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  tie_break_points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bb_team_scores_unique_team UNIQUE (session_id, team_id),
  CONSTRAINT bb_team_scores_total_points_chk CHECK (total_points >= 0)
);

CREATE TABLE IF NOT EXISTS public.bb_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bb_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bb_sessions_event_id ON public.bb_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_bb_sessions_playlist_id ON public.bb_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_bb_sessions_status ON public.bb_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bb_teams_session_id ON public.bb_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_entries_session_id ON public.bb_session_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_rounds_session_id ON public.bb_session_rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_matchups_session_id ON public.bb_session_matchups(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_matchups_round ON public.bb_session_matchups(session_id, round_number);
CREATE INDEX IF NOT EXISTS idx_bb_picks_session_id ON public.bb_bracket_picks(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_scores_session_id ON public.bb_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_bb_events_session_id ON public.bb_session_events(session_id);

COMMIT;
