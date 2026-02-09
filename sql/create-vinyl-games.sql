-- Phase 1: Vinyl Games schema (tournament candidates + game sessions).

CREATE TABLE IF NOT EXISTS public.tournament_candidates (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inventory_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
  artist text NOT NULL,
  title text NOT NULL,
  cover_image text,
  vote_count integer NOT NULL DEFAULT 0,
  is_write_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_candidates_event_id_idx
  ON public.tournament_candidates (event_id);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  crate_id bigint REFERENCES public.crates(id) ON DELETE SET NULL,
  game_type text NOT NULL,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_sessions_event_id_idx
  ON public.game_sessions (event_id);

CREATE OR REPLACE FUNCTION public.get_game_manifest(session_id bigint)
RETURNS TABLE (
  game_session_id bigint,
  crate_id bigint,
  crate_name text,
  inventory_id bigint,
  inventory_location text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    gs.id AS game_session_id,
    c.id AS crate_id,
    c.name AS crate_name,
    i.id AS inventory_id,
    i.location AS inventory_location
  FROM public.game_sessions gs
  JOIN public.crates c ON c.id = gs.crate_id
  JOIN public.crate_items ci ON ci.crate_id = c.id
  JOIN public.inventory i ON i.id = ci.inventory_id
  WHERE gs.id = session_id
  ORDER BY i.location NULLS LAST, i.id;
$$;
