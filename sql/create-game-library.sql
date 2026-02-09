-- Game library items for Vinyl Games.
CREATE TABLE IF NOT EXISTS public.game_library_items (
  id bigserial PRIMARY KEY,
  game_type text NOT NULL,
  item_type text NOT NULL,
  title text,
  artist text,
  prompt text,
  answer text,
  cover_image text,
  inventory_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  decades text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_library_items_game_type_idx
  ON public.game_library_items (game_type);

CREATE INDEX IF NOT EXISTS game_library_items_item_type_idx
  ON public.game_library_items (item_type);

CREATE INDEX IF NOT EXISTS game_library_items_tags_idx
  ON public.game_library_items USING GIN (tags);

CREATE INDEX IF NOT EXISTS game_library_items_genres_idx
  ON public.game_library_items USING GIN (genres);

CREATE INDEX IF NOT EXISTS game_library_items_decades_idx
  ON public.game_library_items USING GIN (decades);
