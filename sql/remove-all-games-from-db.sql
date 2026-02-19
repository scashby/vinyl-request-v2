-- Removes all game-related database objects (legacy + vb namespace).
-- Safe to run multiple times.

BEGIN;

-- Legacy game function(s).
DROP FUNCTION IF EXISTS public.get_game_manifest(integer);

-- Fresh vb namespace tables.
DROP TABLE IF EXISTS public.vb_cards;
DROP TABLE IF EXISTS public.vb_session_calls;
DROP TABLE IF EXISTS public.vb_sessions;
DROP TABLE IF EXISTS public.vb_template_tracks;
DROP TABLE IF EXISTS public.vb_templates;

-- New bingo namespace tables.
DROP TABLE IF EXISTS public.bingo_session_events;
DROP TABLE IF EXISTS public.bingo_cards;
DROP TABLE IF EXISTS public.bingo_session_calls;
DROP TABLE IF EXISTS public.bingo_sessions;

-- Legacy game tables.
DROP TABLE IF EXISTS public.game_cards;
DROP TABLE IF EXISTS public.game_session_picks;
DROP TABLE IF EXISTS public.game_sessions;
DROP TABLE IF EXISTS public.game_template_items;
DROP TABLE IF EXISTS public.game_templates;

COMMIT;
