-- Adds runtime/session columns required by analog-first Bingo host/jumbotron flows.

BEGIN;

-- Ensure base game tables exist (safe on fresh or partially-initialized databases).
CREATE TABLE IF NOT EXISTS public.game_templates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'vinyl_collection',
  setlist_mode boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_template_items (
  id bigserial PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES public.game_templates(id) ON DELETE CASCADE,
  inventory_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
  recording_id bigint REFERENCES public.recordings(id) ON DELETE SET NULL,
  title text NOT NULL,
  artist text NOT NULL,
  side text,
  position text,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  template_id bigint REFERENCES public.game_templates(id) ON DELETE SET NULL,
  game_code text UNIQUE,
  game_type text NOT NULL DEFAULT 'music_bingo',
  variant text NOT NULL DEFAULT 'standard',
  bingo_target text NOT NULL DEFAULT 'one_line',
  card_count integer NOT NULL DEFAULT 40,
  setlist_mode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.game_session_picks (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  template_item_id bigint REFERENCES public.game_template_items(id) ON DELETE SET NULL,
  pick_index integer NOT NULL,
  called_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.game_cards (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  card_number integer NOT NULL,
  has_free_space boolean NOT NULL DEFAULT true,
  grid jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_template_items
  ADD COLUMN IF NOT EXISTS album_name text;

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS round_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS current_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seconds_to_next_call integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.game_session_picks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS prep_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMIT;
