-- Trivia Fact Library v1
-- Creates trivia_facts and trivia_fact_question_links tables.
-- Additive only — does not modify existing trivia tables.

-- ---------------------------------------------------------------------------
-- trivia_facts: intermediate fact library
-- Stores sourced facts about artists, albums, and recordings.
-- Facts are reviewed/approved before being converted into trivia questions.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trivia_facts (
  id                  serial PRIMARY KEY,
  fact_code           text UNIQUE NOT NULL,
  entity_type         text NOT NULL
                      CHECK (entity_type IN ('artist', 'master', 'recording', 'label')),
  entity_id           integer,         -- FK: artists.id / masters.id / recordings.id (not enforced to avoid cross-schema issues)
  entity_ref          text NOT NULL,   -- human label: "The Police", "Synchronicity"
  fact_text           text NOT NULL,
  fact_kind           text NOT NULL DEFAULT 'bio'
                      CHECK (fact_kind IN (
                        'bio',
                        'recording_context',
                        'chart_fact',
                        'production_note',
                        'cultural_context',
                        'critical_reception'
                      )),
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'archived')),
  confidence          text NOT NULL DEFAULT 'medium'
                      CHECK (confidence IN ('low', 'medium', 'high')),
  generation_run_id   integer REFERENCES trivia_import_runs(id) ON DELETE SET NULL,
  source_record_id    integer REFERENCES trivia_source_records(id) ON DELETE SET NULL,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trivia_facts_entity_idx
  ON trivia_facts (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS trivia_facts_status_idx
  ON trivia_facts (status);

CREATE INDEX IF NOT EXISTS trivia_facts_run_idx
  ON trivia_facts (generation_run_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_trivia_facts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trivia_facts_updated_at ON trivia_facts;
CREATE TRIGGER trivia_facts_updated_at
  BEFORE UPDATE ON trivia_facts
  FOR EACH ROW EXECUTE FUNCTION set_trivia_facts_updated_at();

-- ---------------------------------------------------------------------------
-- trivia_fact_question_links: provenance join
-- Traces which fact a question was generated from.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trivia_fact_question_links (
  id          serial PRIMARY KEY,
  fact_id     integer NOT NULL REFERENCES trivia_facts(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES trivia_questions(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fact_id, question_id)
);

CREATE INDEX IF NOT EXISTS trivia_fact_question_links_fact_idx
  ON trivia_fact_question_links (fact_id);

CREATE INDEX IF NOT EXISTS trivia_fact_question_links_question_idx
  ON trivia_fact_question_links (question_id);
