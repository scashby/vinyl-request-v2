-- Add Vinyl Games metadata to events.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS has_games boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS game_modes text[];
