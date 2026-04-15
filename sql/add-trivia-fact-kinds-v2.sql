-- Expand trivia_facts.fact_kind to include AI-generated trivia categories.
-- Run after add-trivia-fact-library-v1.sql.

ALTER TABLE trivia_facts
  DROP CONSTRAINT IF EXISTS trivia_facts_fact_kind_check;

ALTER TABLE trivia_facts
  ADD CONSTRAINT trivia_facts_fact_kind_check
  CHECK (fact_kind IN (
    -- Original DB-extraction kinds
    'bio',
    'recording_context',
    'chart_fact',
    'production_note',
    'cultural_context',
    'critical_reception',
    -- AI-generated trivia kinds (from generateRawTrivia)
    'name_origin',
    'connection',
    'pre_fame',
    'collaboration',
    'personal',
    'song_history',
    'band_history',
    'unusual_skill',
    'other'
  ));
