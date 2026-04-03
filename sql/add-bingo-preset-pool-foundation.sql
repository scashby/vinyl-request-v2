-- Foundation for favorite/preset-owned fixed pools and pool-scoped crates.
-- This is additive and backward-compatible with existing bingo session flows.

CREATE TABLE IF NOT EXISTS public.bingo_game_presets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  source_playlist_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  pool_size integer NOT NULL DEFAULT 75 CHECK (pool_size > 0),
  created_from_session_id bigint REFERENCES public.bingo_sessions(id) ON DELETE SET NULL,
  note text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bingo_game_pool_tracks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  preset_id bigint NOT NULL REFERENCES public.bingo_game_presets(id) ON DELETE CASCADE,
  track_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_game_pool_tracks_unique UNIQUE (preset_id, track_key)
);

CREATE INDEX IF NOT EXISTS idx_bingo_game_pool_tracks_preset
  ON public.bingo_game_pool_tracks(preset_id, sort_order, id);

CREATE TABLE IF NOT EXISTS public.bingo_preset_crates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  preset_id bigint NOT NULL REFERENCES public.bingo_game_presets(id) ON DELETE CASCADE,
  crate_letter text NOT NULL CHECK (crate_letter ~ '^[A-Z]$'),
  crate_name text NOT NULL,
  call_order jsonb NOT NULL,
  created_from_session_id bigint REFERENCES public.bingo_sessions(id) ON DELETE SET NULL,
  created_for_round integer CHECK (created_for_round IS NULL OR created_for_round >= 1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bingo_preset_crates_unique UNIQUE (preset_id, crate_letter)
);

CREATE INDEX IF NOT EXISTS idx_bingo_preset_crates_preset
  ON public.bingo_preset_crates(preset_id, crate_letter);

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS game_preset_id bigint REFERENCES public.bingo_game_presets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bingo_sessions_game_preset_id
  ON public.bingo_sessions(game_preset_id);
