-- Add bingo parity fields to lgr_sessions and create lgr_session_events if missing
ALTER TABLE public.lgr_sessions
  ADD COLUMN IF NOT EXISTS show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_heading_text text,
  ADD COLUMN IF NOT EXISTS welcome_message_text text,
  ADD COLUMN IF NOT EXISTS intermission_heading_text text,
  ADD COLUMN IF NOT EXISTS intermission_message_text text,
  ADD COLUMN IF NOT EXISTS thanks_heading_text text,
  ADD COLUMN IF NOT EXISTS thanks_subheading_text text,
  ADD COLUMN IF NOT EXISTS default_intermission_seconds integer NOT NULL DEFAULT 600;

-- Create lgr_session_events table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lgr_session_events (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id bigint NOT NULL REFERENCES public.lgr_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lgr_session_events_session_id ON public.lgr_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_lgr_session_events_event_type ON public.lgr_session_events(event_type);
