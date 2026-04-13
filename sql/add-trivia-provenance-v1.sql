BEGIN;

CREATE TABLE IF NOT EXISTS public.trivia_import_runs (
  id bigserial PRIMARY KEY,
  run_code text NOT NULL UNIQUE,
  source_mode text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  triggered_by text,
  scope_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT trivia_import_runs_source_mode_chk CHECK (
    source_mode IN ('manual', 'api', 'editorial', 'search')
  ),
  CONSTRAINT trivia_import_runs_status_chk CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS public.trivia_source_records (
  id bigserial PRIMARY KEY,
  import_run_id bigint REFERENCES public.trivia_import_runs(id) ON DELETE SET NULL,
  source_kind text NOT NULL DEFAULT 'editorial',
  source_url text,
  source_domain text,
  source_title text,
  excerpt_text text,
  claim_text text,
  verification_status text NOT NULL DEFAULT 'unreviewed',
  verification_notes text,
  fetched_at timestamptz,
  published_at timestamptz,
  content_hash text,
  metadata_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_source_records_source_kind_chk CHECK (
    source_kind IN ('manual', 'api', 'editorial', 'reference')
  ),
  CONSTRAINT trivia_source_records_verification_status_chk CHECK (
    verification_status IN ('unreviewed', 'approved', 'rejected', 'superseded')
  )
);

CREATE TABLE IF NOT EXISTS public.trivia_question_sources (
  id bigserial PRIMARY KEY,
  question_id bigint NOT NULL REFERENCES public.trivia_questions(id) ON DELETE CASCADE,
  source_record_id bigint NOT NULL REFERENCES public.trivia_source_records(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'research',
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  citation_excerpt text,
  claim_text text,
  verification_notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trivia_question_sources_relationship_type_chk CHECK (
    relationship_type IN ('research', 'verification', 'inspiration', 'manual_note')
  ),
  CONSTRAINT trivia_question_sources_unique UNIQUE (question_id, source_record_id)
);

CREATE INDEX IF NOT EXISTS trivia_import_runs_status_idx
  ON public.trivia_import_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS trivia_source_records_import_run_idx
  ON public.trivia_source_records (import_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trivia_source_records_domain_idx
  ON public.trivia_source_records (source_domain, verification_status);

CREATE INDEX IF NOT EXISTS trivia_source_records_hash_idx
  ON public.trivia_source_records (content_hash);

CREATE INDEX IF NOT EXISTS trivia_question_sources_question_idx
  ON public.trivia_question_sources (question_id, sort_order);

CREATE INDEX IF NOT EXISTS trivia_question_sources_source_idx
  ON public.trivia_question_sources (source_record_id);

COMMIT;