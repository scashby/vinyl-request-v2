BEGIN;

ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true;

ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS welcome_heading_text text;
ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS welcome_message_text text;
ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS intermission_heading_text text;
ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS intermission_message_text text;
ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS thanks_heading_text text;
ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS thanks_subheading_text text;

ALTER TABLE public.ndr_sessions
  ADD COLUMN IF NOT EXISTS default_intermission_seconds integer NOT NULL DEFAULT 600;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ndr_sessions_default_intermission_seconds_chk'
  ) THEN
    ALTER TABLE public.ndr_sessions
      ADD CONSTRAINT ndr_sessions_default_intermission_seconds_chk
      CHECK (default_intermission_seconds >= 0);
  END IF;
END $$;

UPDATE public.ndr_sessions
SET
  welcome_heading_text = COALESCE(welcome_heading_text, 'Welcome to Needle Drop Roulette'),
  welcome_message_text = COALESCE(welcome_message_text, 'Get your team ready for the next drop.'),
  intermission_heading_text = COALESCE(intermission_heading_text, 'Intermission'),
  intermission_message_text = COALESCE(intermission_message_text, 'Quick reset. Next drop starts soon.'),
  thanks_heading_text = COALESCE(thanks_heading_text, 'Thanks for Playing'),
  thanks_subheading_text = COALESCE(thanks_subheading_text, 'See you at the next round.'),
  default_intermission_seconds = COALESCE(default_intermission_seconds, 600)
WHERE TRUE;

COMMIT;
