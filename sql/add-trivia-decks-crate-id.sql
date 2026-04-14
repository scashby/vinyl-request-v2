-- Add crate_id to trivia_decks for crate targeting
ALTER TABLE public.trivia_decks ADD COLUMN IF NOT EXISTS crate_id bigint;
CREATE INDEX IF NOT EXISTS trivia_decks_crate_id_idx ON public.trivia_decks (crate_id);