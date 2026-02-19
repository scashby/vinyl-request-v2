-- Fresh Vinyl Bingo schema (ground-up, no legacy game tables required)

BEGIN;

CREATE TABLE IF NOT EXISTS public.vb_templates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'vinyl_collection',
  setlist_mode boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vb_template_tracks (
  id bigserial PRIMARY KEY,
  template_id bigint NOT NULL REFERENCES public.vb_templates(id) ON DELETE CASCADE,
  inventory_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
  recording_id bigint REFERENCES public.recordings(id) ON DELETE SET NULL,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  album_name text,
  side text,
  position text,
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vb_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  template_id bigint REFERENCES public.vb_templates(id) ON DELETE SET NULL,
  session_code text UNIQUE,
  variant text NOT NULL DEFAULT 'standard',
  bingo_target text NOT NULL DEFAULT 'single_line',
  card_count integer NOT NULL DEFAULT 40,
  round_count integer NOT NULL DEFAULT 3,
  current_round integer NOT NULL DEFAULT 1,
  seconds_to_next_call integer NOT NULL DEFAULT 45,
  current_call_index integer NOT NULL DEFAULT 0,
  paused_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vb_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.vb_sessions(id) ON DELETE CASCADE,
  template_track_id bigint REFERENCES public.vb_template_tracks(id) ON DELETE SET NULL,
  call_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  called_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vb_cards (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.vb_sessions(id) ON DELETE CASCADE,
  card_number integer NOT NULL,
  has_free_space boolean NOT NULL DEFAULT true,
  grid jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vb_tracks_template_id ON public.vb_template_tracks(template_id);
CREATE INDEX IF NOT EXISTS idx_vb_calls_session_id ON public.vb_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_vb_cards_session_id ON public.vb_cards(session_id);

COMMIT;
