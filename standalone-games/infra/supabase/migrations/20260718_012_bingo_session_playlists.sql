BEGIN;

CREATE TABLE IF NOT EXISTS public.sg_game_bingo_session_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sg_game_bingo_sessions(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  playlist_letter text NOT NULL,
  playlist_name text NOT NULL,
  call_order jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sg_game_bingo_session_playlists_round_chk CHECK (round_number >= 1),
  CONSTRAINT sg_game_bingo_session_playlists_letter_chk CHECK (char_length(playlist_letter) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_sg_bingo_session_playlists_session
  ON public.sg_game_bingo_session_playlists(session_id, playlist_letter, round_number);

ALTER TABLE public.sg_game_bingo_session_playlists ENABLE ROW LEVEL SECURITY;

COMMIT;
