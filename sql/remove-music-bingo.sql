-- Remove Music Bingo runtime tables and related event metadata.
-- WARNING: This permanently deletes game sessions, templates, picks, and cards.

BEGIN;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS has_games,
  DROP COLUMN IF EXISTS game_modes;

DROP TABLE IF EXISTS public.game_cards;
DROP TABLE IF EXISTS public.game_session_picks;
DROP TABLE IF EXISTS public.game_sessions;
DROP TABLE IF EXISTS public.game_template_items;
DROP TABLE IF EXISTS public.game_templates;
DROP TABLE IF EXISTS public.game_library_items;

COMMIT;
