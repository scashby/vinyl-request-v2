-- Add an optional dedicated square-format image for events, so a
-- widescreen/cover photo doesn't have to be the only source cropped for
-- both the 16:9 "Up Next" card and the 1:1 grid/thumbnail placements.
-- When set, image_url_square is used for the square placements instead of
-- cropping image_url; when null, those placements fall back to cropping
-- image_url via the existing image_focus_square tag. Safe to re-run.

BEGIN;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS image_url_square text;

COMMIT;
