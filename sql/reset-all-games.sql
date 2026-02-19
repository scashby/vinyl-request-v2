-- HARD RESET: remove all legacy and new game tables/data.
-- Run this in Supabase SQL Editor before rebuilding fresh game features.

BEGIN;

-- New fresh namespace (vb_*)
DROP TABLE IF EXISTS public.vb_cards;
DROP TABLE IF EXISTS public.vb_session_calls;
DROP TABLE IF EXISTS public.vb_sessions;
DROP TABLE IF EXISTS public.vb_template_tracks;
DROP TABLE IF EXISTS public.vb_templates;

-- Legacy namespace (game_*)
DROP TABLE IF EXISTS public.game_cards;
DROP TABLE IF EXISTS public.game_session_picks;
DROP TABLE IF EXISTS public.game_sessions;
DROP TABLE IF EXISTS public.game_template_items;
DROP TABLE IF EXISTS public.game_templates;
DROP TABLE IF EXISTS public.game_library_items;

COMMIT;
