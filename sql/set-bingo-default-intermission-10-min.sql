BEGIN;

-- Persist 10 minutes as the platform default for intermission timing.
ALTER TABLE public.bingo_sessions
  ALTER COLUMN default_intermission_seconds SET DEFAULT 600;

-- Retrofit legacy sessions that still carry old short defaults (e.g. 180/300 seconds).
UPDATE public.bingo_sessions
SET default_intermission_seconds = 600
WHERE default_intermission_seconds IS NULL
   OR default_intermission_seconds <= 300;

COMMIT;
