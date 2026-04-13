BEGIN;

ALTER TABLE public.ooc_sessions
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_heading_text text,
  ADD COLUMN IF NOT EXISTS welcome_message_text text,
  ADD COLUMN IF NOT EXISTS intermission_heading_text text,
  ADD COLUMN IF NOT EXISTS intermission_message_text text,
  ADD COLUMN IF NOT EXISTS thanks_heading_text text,
  ADD COLUMN IF NOT EXISTS thanks_subheading_text text,
  ADD COLUMN IF NOT EXISTS default_intermission_seconds integer NOT NULL DEFAULT 600;

ALTER TABLE public.ooc_sessions
  DROP CONSTRAINT IF EXISTS ooc_sessions_default_intermission_seconds_chk;

ALTER TABLE public.ooc_sessions
  ADD CONSTRAINT ooc_sessions_default_intermission_seconds_chk CHECK (default_intermission_seconds >= 0);

UPDATE public.ooc_sessions
SET
  welcome_heading_text = COALESCE(NULLIF(welcome_heading_text, ''), 'Welcome to Original or Cover'),
  welcome_message_text = COALESCE(NULLIF(welcome_message_text, ''), 'Call it: original or cover.'),
  intermission_heading_text = COALESCE(NULLIF(intermission_heading_text, ''), 'Intermission'),
  intermission_message_text = COALESCE(NULLIF(intermission_message_text, ''), 'Short break before the next round.'),
  thanks_heading_text = COALESCE(NULLIF(thanks_heading_text, ''), 'Thanks for Playing'),
  thanks_subheading_text = COALESCE(NULLIF(thanks_subheading_text, ''), 'See you at the next round.'),
  default_intermission_seconds = COALESCE(default_intermission_seconds, 600)
WHERE
  welcome_heading_text IS NULL
  OR welcome_message_text IS NULL
  OR intermission_heading_text IS NULL
  OR intermission_message_text IS NULL
  OR thanks_heading_text IS NULL
  OR thanks_subheading_text IS NULL
  OR default_intermission_seconds IS NULL;

COMMIT;
