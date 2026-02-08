-- Game templates for Vinyl Games.
CREATE TABLE IF NOT EXISTS public.game_templates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  game_type text NOT NULL,
  template_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
