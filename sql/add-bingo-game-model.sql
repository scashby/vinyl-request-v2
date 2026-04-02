BEGIN;

ALTER TABLE public.bingo_sessions
  ADD COLUMN IF NOT EXISTS master_playlist_ids jsonb,
  ADD COLUMN IF NOT EXISTS round_crate_ids jsonb,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorite_note text;

UPDATE public.bingo_sessions
SET master_playlist_ids = COALESCE(playlist_ids, jsonb_build_array(playlist_id))
WHERE master_playlist_ids IS NULL;

CREATE TABLE IF NOT EXISTS public.bingo_session_round_tracks (
  id bigserial PRIMARY KEY,
  session_id bigint NOT NULL REFERENCES public.bingo_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  slot_index integer NOT NULL,
  playlist_track_key text NOT NULL,
  source_playlist_id bigint REFERENCES public.collection_playlists(id) ON DELETE SET NULL,
  track_title text NOT NULL,
  artist_name text NOT NULL,
  album_name text,
  side text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bingo_session_round_tracks_round_chk CHECK (round_number >= 1),
  CONSTRAINT bingo_session_round_tracks_slot_chk CHECK (slot_index >= 1),
  CONSTRAINT bingo_session_round_tracks_unique_slot UNIQUE (session_id, round_number, slot_index),
  CONSTRAINT bingo_session_round_tracks_unique_track UNIQUE (session_id, round_number, playlist_track_key)
);

CREATE INDEX IF NOT EXISTS idx_bingo_round_tracks_session_round
  ON public.bingo_session_round_tracks(session_id, round_number);

ALTER TABLE public.bingo_cards
  ADD COLUMN IF NOT EXISTS card_identifier text;

UPDATE public.bingo_cards AS cards
SET card_identifier = UPPER(regexp_replace(COALESCE(session.session_code, 'BINGO'), '[^A-Za-z0-9-]+', '-', 'g')) || '-' || lpad(cards.card_number::text, 3, '0')
FROM public.bingo_sessions AS session
WHERE session.id = cards.session_id
  AND (cards.card_identifier IS NULL OR btrim(cards.card_identifier) = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bingo_cards'
      AND constraint_name = 'bingo_cards_unique_card_identifier'
  ) THEN
    ALTER TABLE public.bingo_cards
      ADD CONSTRAINT bingo_cards_unique_card_identifier UNIQUE (card_identifier);
  END IF;
END $$;

ALTER TABLE public.bingo_cards
  ALTER COLUMN card_identifier SET NOT NULL;

COMMIT;