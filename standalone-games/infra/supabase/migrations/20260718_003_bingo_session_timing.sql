BEGIN;

ALTER TABLE public.sg_game_bingo_sessions
  ADD COLUMN IF NOT EXISTS remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS place_vinyl_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS cue_seconds integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS start_slide_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS host_buffer_seconds integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sonos_output_delay_ms integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS call_reveal_delay_seconds integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_intermission_seconds integer NOT NULL DEFAULT 600;

COMMIT;
