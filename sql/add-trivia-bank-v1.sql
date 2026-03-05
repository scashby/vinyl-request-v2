BEGIN;

CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id bigserial PRIMARY KEY,
  question_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  question_type text NOT NULL DEFAULT 'free_response',
  prompt_text text NOT NULL,
  answer_key text NOT NULL DEFAULT '',
  accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  options_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  reveal_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_element_type text NOT NULL DEFAULT 'song',
  explanation_text text,
  default_category text NOT NULL DEFAULT 'General Music',
  default_difficulty text NOT NULL DEFAULT 'medium',
  source_note text,
  is_tiebreaker_eligible boolean NOT NULL DEFAULT true,
  cue_notes_text text,
  cue_payload jsonb NOT NULL DEFAULT '{"segments":[]}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT trivia_questions_status_chk CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT trivia_questions_type_chk CHECK (
    question_type IN ('free_response', 'multiple_choice', 'true_false', 'ordering')
  ),
  CONSTRAINT trivia_questions_display_element_type_chk CHECK (
    display_element_type IN ('song', 'artist', 'album', 'cover_art', 'vinyl_label')
  ),
  CONSTRAINT trivia_questions_default_difficulty_chk CHECK (
    default_difficulty IN ('easy', 'medium', 'hard')
  )
);

CREATE TABLE IF NOT EXISTS public.trivia_question_facets (
  question_id bigint PRIMARY KEY REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  era text,
  genre text,
  decade text,
  region text,
  language text,
  has_media boolean NOT NULL DEFAULT false,
  difficulty text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'General Music',
  CONSTRAINT trivia_question_facets_difficulty_chk CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  )
);

ALTER TABLE public.trivia_questions
  ADD COLUMN IF NOT EXISTS answer_key text NOT NULL DEFAULT '';
ALTER TABLE public.trivia_questions
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.trivia_questions
  ADD COLUMN IF NOT EXISTS reveal_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trivia_questions
  ADD COLUMN IF NOT EXISTS display_element_type text NOT NULL DEFAULT 'song';

CREATE TABLE IF NOT EXISTS public.trivia_question_tags (
  id bigserial PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_question_tags_unique UNIQUE (question_id, tag)
);

CREATE TABLE IF NOT EXISTS public.trivia_question_assets (
  id bigserial PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  asset_role text NOT NULL DEFAULT 'clue_primary',
  asset_type text NOT NULL DEFAULT 'image',
  bucket text NOT NULL DEFAULT 'trivia-assets',
  object_path text NOT NULL,
  mime_type text,
  width integer,
  height integer,
  duration_seconds numeric(10,3),
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_question_assets_role_chk CHECK (
    asset_role IN ('clue_primary', 'clue_secondary', 'answer_visual', 'explanation_media')
  ),
  CONSTRAINT trivia_question_assets_type_chk CHECK (
    asset_type IN ('image', 'audio', 'video')
  )
);

CREATE TABLE IF NOT EXISTS public.trivia_decks (
  id bigserial PRIMARY KEY,
  deck_code text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  build_mode text NOT NULL DEFAULT 'hybrid',
  rules_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_days integer NOT NULL DEFAULT 90,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  CONSTRAINT trivia_decks_status_chk CHECK (
    status IN ('draft', 'ready', 'archived')
  ),
  CONSTRAINT trivia_decks_build_mode_chk CHECK (
    build_mode IN ('manual', 'hybrid', 'rule')
  ),
  CONSTRAINT trivia_decks_cooldown_days_chk CHECK (cooldown_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.trivia_deck_items (
  id bigserial PRIMARY KEY,
  deck_id bigint NOT NULL REFERENCES public.trivia_decks(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  is_tiebreaker boolean NOT NULL DEFAULT false,
  question_id bigint REFERENCES public.trivia_questions(id) ON DELETE SET NULL,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_deck_items_unique_index UNIQUE (deck_id, item_index),
  CONSTRAINT trivia_deck_items_round_chk CHECK (round_number > 0),
  CONSTRAINT trivia_deck_items_item_index_chk CHECK (item_index > 0)
);

ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS deck_id bigint;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS show_cue_hints boolean NOT NULL DEFAULT false;

ALTER TABLE public.trivia_sessions
  DROP CONSTRAINT IF EXISTS trivia_sessions_deck_id_fkey;
ALTER TABLE public.trivia_sessions
  ADD CONSTRAINT trivia_sessions_deck_id_fkey
  FOREIGN KEY (deck_id) REFERENCES public.trivia_decks(id) ON DELETE SET NULL;

ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS question_id bigint;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'free_response';
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS options_payload jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS explanation_text text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS reveal_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS cue_notes_text text;
ALTER TABLE public.trivia_session_calls
  ADD COLUMN IF NOT EXISTS cue_payload jsonb NOT NULL DEFAULT '{"segments":[]}'::jsonb;

ALTER TABLE public.trivia_session_calls
  DROP CONSTRAINT IF EXISTS trivia_session_calls_question_id_fkey;
ALTER TABLE public.trivia_session_calls
  ADD CONSTRAINT trivia_session_calls_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES public.trivia_questions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_session_calls_question_type_chk'
  ) THEN
    ALTER TABLE public.trivia_session_calls
      ADD CONSTRAINT trivia_session_calls_question_type_chk
      CHECK (question_type IN ('free_response', 'multiple_choice', 'true_false', 'ordering'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_questions_display_element_type_chk'
  ) THEN
    ALTER TABLE public.trivia_questions
      ADD CONSTRAINT trivia_questions_display_element_type_chk
      CHECK (display_element_type IN ('song', 'artist', 'album', 'cover_art', 'vinyl_label'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trivia_questions_status ON public.trivia_questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_type ON public.trivia_questions(question_type, default_difficulty);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_prompt_lower ON public.trivia_questions ((lower(prompt_text)));
CREATE INDEX IF NOT EXISTS idx_trivia_q_facets_category ON public.trivia_question_facets(category, difficulty, has_media);
CREATE INDEX IF NOT EXISTS idx_trivia_q_tags_tag ON public.trivia_question_tags(tag);
CREATE INDEX IF NOT EXISTS idx_trivia_q_assets_question ON public.trivia_question_assets(question_id, asset_role, sort_order);
CREATE INDEX IF NOT EXISTS idx_trivia_decks_status ON public.trivia_decks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_decks_event ON public.trivia_decks(event_id, status);
CREATE INDEX IF NOT EXISTS idx_trivia_deck_items_deck ON public.trivia_deck_items(deck_id, item_index);
CREATE INDEX IF NOT EXISTS idx_trivia_sessions_deck_id ON public.trivia_sessions(deck_id);
CREATE INDEX IF NOT EXISTS idx_trivia_calls_question_id ON public.trivia_session_calls(question_id);

COMMIT;
