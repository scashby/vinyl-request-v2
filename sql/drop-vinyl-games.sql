-- Remove Vinyl Games tables and event metadata.
-- WARNING: This deletes all Vinyl Games data.

ALTER TABLE public.events
  DROP COLUMN IF EXISTS has_games,
  DROP COLUMN IF EXISTS game_modes;

DROP TABLE IF EXISTS public.game_template_items;
DROP TABLE IF EXISTS public.game_templates;
DROP TABLE IF EXISTS public.game_library_items;
DROP TABLE IF EXISTS public.game_sessions;
