BEGIN;

CREATE TABLE IF NOT EXISTS public.trivia_question_scopes (
  id bigserial PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_ref_id bigint,
  scope_value text,
  display_label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_question_scopes_scope_type_chk CHECK (
    scope_type IN ('playlist', 'crate', 'format', 'artist', 'album', 'track')
  )
);

CREATE INDEX IF NOT EXISTS trivia_question_scopes_question_idx
  ON public.trivia_question_scopes (question_id, sort_order);

CREATE INDEX IF NOT EXISTS trivia_question_scopes_type_idx
  ON public.trivia_question_scopes (scope_type, scope_ref_id);

CREATE INDEX IF NOT EXISTS trivia_question_scopes_value_idx
  ON public.trivia_question_scopes (scope_type, scope_value);

COMMIT;