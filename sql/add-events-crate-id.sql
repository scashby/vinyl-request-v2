-- Add crate_id to events for associating a collection crate with an event.
-- This mirrors how crates are managed in edit-collection while allowing events
-- to reference a single crate.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS crate_id bigint;

ALTER TABLE public.events
ADD CONSTRAINT events_crate_id_fkey
FOREIGN KEY (crate_id) REFERENCES public.crates(id);
