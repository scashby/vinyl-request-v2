-- Game template items linking library entries to templates.
CREATE TABLE IF NOT EXISTS public.game_template_items (
  id bigserial PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES public.game_templates(id) ON DELETE CASCADE,
  library_item_id bigint NOT NULL REFERENCES public.game_library_items(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_template_items_template_id_idx
  ON public.game_template_items (template_id);

CREATE INDEX IF NOT EXISTS game_template_items_library_item_id_idx
  ON public.game_template_items (library_item_id);
