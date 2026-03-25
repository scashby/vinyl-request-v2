alter table public.bingo_sessions
add column if not exists round_playlist_ids jsonb;