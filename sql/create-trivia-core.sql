BEGIN;

CREATE TABLE IF NOT EXISTS public.trivia_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL,
  round_count integer NOT NULL DEFAULT 3,
  questions_per_round integer NOT NULL DEFAULT 5,
  score_mode text NOT NULL DEFAULT 'difficulty_bonus_static',
  question_categories text[] NOT NULL DEFAULT ARRAY['General Music']::text[],
  difficulty_easy_target integer NOT NULL DEFAULT 2,
  difficulty_medium_target integer NOT NULL DEFAULT 2,
  difficulty_hard_target integer NOT NULL DEFAULT 1,
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
  show_question_counter boolean NOT NULL DEFAULT true,
  show_leaderboard boolean NOT NULL DEFAULT true,
  max_teams integer,
  slips_batch_size integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT trivia_sessions_score_mode_chk CHECK (
    score_mode IN ('standard', 'difficulty_bonus_static')
  ),
  CONSTRAINT trivia_sessions_status_chk CHECK (
    status IN ('pending', 'running', 'paused', 'completed')
  ),
  CONSTRAINT trivia_sessions_round_count_chk CHECK (round_count > 0),
  CONSTRAINT trivia_sessions_questions_per_round_chk CHECK (questions_per_round > 0),
  CONSTRAINT trivia_sessions_target_gap_seconds_chk CHECK (target_gap_seconds > 0)
);

CREATE TABLE IF NOT EXISTS public.trivia_session_teams (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  table_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_session_teams_unique_name UNIQUE (session_id, team_name)
);

CREATE TABLE IF NOT EXISTS public.trivia_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  call_index integer NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL,
  question_text text NOT NULL,
  answer_key text NOT NULL,
  accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_note text,
  base_points integer NOT NULL DEFAULT 1,
  bonus_points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  asked_at timestamptz,
  answer_revealed_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_session_calls_difficulty_chk CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  ),
  CONSTRAINT trivia_session_calls_status_chk CHECK (
    status IN ('pending', 'asked', 'answer_revealed', 'scored', 'skipped')
  ),
  CONSTRAINT trivia_session_calls_unique_call_index UNIQUE (session_id, call_index)
);

CREATE TABLE IF NOT EXISTS public.trivia_team_scores (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.trivia_session_teams(id) ON DELETE CASCADE,
  call_id bigint NOT NULL REFERENCES public.trivia_session_calls(id) ON DELETE CASCADE,
  awarded_points integer NOT NULL DEFAULT 0,
  correct boolean NOT NULL DEFAULT false,
  scored_by text,
  notes text,
  scored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_team_scores_unique_entry UNIQUE (session_id, team_id, call_id)
);

CREATE TABLE IF NOT EXISTS public.trivia_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trivia_sessions_event_id ON public.trivia_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_trivia_sessions_status ON public.trivia_sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_session_id ON public.trivia_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_status ON public.trivia_session_calls(session_id, status);
CREATE INDEX IF NOT EXISTS idx_trivia_teams_session_id ON public.trivia_session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_scores_session_id ON public.trivia_team_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_scores_call_id ON public.trivia_team_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_trivia_events_session_id ON public.trivia_session_events(session_id);

COMMIT;
