BEGIN;

ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true;

ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS trivia_overlay text NOT NULL DEFAULT 'welcome';

ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS welcome_heading_text text;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS welcome_message_text text;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS intermission_heading_text text;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS intermission_message_text text;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS thanks_heading_text text;
ALTER TABLE public.trivia_sessions
  ADD COLUMN IF NOT EXISTS thanks_subheading_text text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trivia_sessions_overlay_chk'
  ) THEN
    ALTER TABLE public.trivia_sessions
      ADD CONSTRAINT trivia_sessions_overlay_chk
      CHECK (trivia_overlay IN ('none', 'welcome', 'intermission', 'thanks'));
  END IF;
END $$;

UPDATE public.trivia_sessions
SET
  trivia_overlay = COALESCE(trivia_overlay, 'welcome'),
  welcome_heading_text = COALESCE(welcome_heading_text, 'Welcome to Music Trivia'),
  welcome_message_text = COALESCE(welcome_message_text, 'Get your team ready and watch the jumbotron for the first question.'),
  intermission_heading_text = COALESCE(intermission_heading_text, 'Intermission'),
  intermission_message_text = COALESCE(intermission_message_text, 'Quick reset. Next round starts shortly.'),
  thanks_heading_text = COALESCE(thanks_heading_text, 'Thanks for Playing'),
  thanks_subheading_text = COALESCE(thanks_subheading_text, 'See you at the next trivia night.')
WHERE TRUE;

COMMIT;
