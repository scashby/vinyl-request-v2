-- Fresh Bingo-only schema (playlist-song source, no legacy game tables)

BEGIN;

CREATE TABLE IF NOT EXISTS public.bingo_sessions (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES public.events(id) ON DELETE SET NULL,
  playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  session_code text NOT NULL UNIQUE,
  game_mode text NOT NULL,
  card_count integer NOT NULL DEFAULT 40,
  card_layout text NOT NULL DEFAULT '2-up',
  card_label_mode text NOT NULL DEFAULT 'track_artist',
  round_count integer NOT NULL DEFAULT 3,
  current_round integer NOT NULL DEFAULT 1,
  round_end_policy text NOT NULL DEFAULT 'open_until_winner',
  tie_break_policy text NOT NULL DEFAULT 'one_song_playoff',
  pool_exhaustion_policy text NOT NULL DEFAULT 'declare_tie',
  remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  place_vinyl_seconds integer NOT NULL DEFAULT 8,
  cue_seconds integer NOT NULL DEFAULT 12,
  start_slide_seconds integer NOT NULL DEFAULT 5,
  host_buffer_seconds integer NOT NULL DEFAULT 2,
  seconds_to_next_call integer NOT NULL DEFAULT 45,
  sonos_output_delay_ms integer NOT NULL DEFAULT 75,
  countdown_started_at timestamptz,
  paused_remaining_seconds integer,
  paused_at timestamptz,
  current_call_index integer NOT NULL DEFAULT 0,
  recent_calls_limit integer NOT NULL DEFAULT 5,
  show_title boolean NOT NULL DEFAULT true,
  show_logo boolean NOT NULL DEFAULT true,
  show_rounds boolean NOT NULL DEFAULT true,
  show_countdown boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  CONSTRAINT bingo_sessions_game_mode_chk CHECK (
    game_mode IN ('single_line', 'double_line', 'triple_line', 'criss_cross', 'four_corners', 'blackout', 'death')
  ),
  CONSTRAINT bingo_sessions_card_layout_chk CHECK (
    card_layout IN ('2-up', '4-up')
  ),
  CONSTRAINT bingo_sessions_card_label_mode_chk CHECK (
    card_label_mode IN ('track_artist', 'track_only')
  ),
  CONSTRAINT bingo_sessions_status_chk CHECK (
    status IN ('pending', 'running', 'paused', 'completed')
  )
);

-- Backfill/upgrade for existing installs that ran an older version of this script
-- (CREATE TABLE IF NOT EXISTS won't add new columns).
ALTER TABLE public.bingo_sessions
  DROP CONSTRAINT IF EXISTS bingo_sessions_playlist_id_fkey;

ALTER TABLE public.bingo_sessions
  ALTER COLUMN playlist_id DROP NOT NULL;

ALTER TABLE public.bingo_sessions
  ADD CONSTRAINT bingo_sessions_playlist_id_fkey
  FOREIGN KEY (playlist_id) REFERENCES public.collection_playlists(id) ON DELETE SET NULL;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS remove_resleeve_seconds integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS place_vinyl_seconds integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS cue_seconds integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS start_slide_seconds integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS host_buffer_seconds integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS seconds_to_next_call integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS sonos_output_delay_ms integer NOT NULL DEFAULT 75;

CREATE TABLE IF NOT EXISTS public.bingo_session_calls (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  playlist_track_key text,
  call_index integer NOT NULL,
  ball_number integer,
  column_letter text NOT NULL,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  album_name text,
  side text,
  position text,
  status text NOT NULL DEFAULT 'pending',
  prep_started_at timestamptz,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_session_calls_column_letter_chk CHECK (column_letter IN ('B', 'I', 'N', 'G', 'O')),
  CONSTRAINT bingo_session_calls_status_chk CHECK (
    status IN ('pending', 'prep_started', 'called', 'completed', 'skipped')
  ),
  CONSTRAINT bingo_session_calls_unique_call_index UNIQUE (session_id, call_index)
);

ALTER TABLE public.bingo_session_calls
  ADD COLUMN IF NOT EXISTS ball_number integer;

CREATE TABLE IF NOT EXISTS public.bingo_cards (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  card_number integer NOT NULL,
  has_free_space boolean NOT NULL DEFAULT true,
  grid jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_cards_unique_card_number UNIQUE (session_id, card_number)
);

CREATE TABLE IF NOT EXISTS public.bingo_session_events (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bingo_sessions_event_id ON public.bingo_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_bingo_sessions_playlist_id ON public.bingo_sessions(playlist_id);
CREATE INDEX IF NOT EXISTS idx_bingo_calls_session_id ON public.bingo_session_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_bingo_calls_status ON public.bingo_session_calls(session_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bingo_calls_unique_ball_number ON public.bingo_session_calls(session_id, ball_number) WHERE ball_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bingo_cards_session_id ON public.bingo_cards(session_id);
CREATE INDEX IF NOT EXISTS idx_bingo_events_session_id ON public.bingo_session_events(session_id);

COMMIT;
