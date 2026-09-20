-- Allow 'homepageImage' as an image_assets.image_kind, alongside the
-- existing 'eventImage' and 'venueLogo'. Needed for the new hero/Game
-- Deck photo pickers in /admin/edit-home (see
-- add-homepage-images-storage.sql for the matching storage bucket).

ALTER TABLE public.image_assets
DROP CONSTRAINT IF EXISTS image_assets_image_kind_check;

ALTER TABLE public.image_assets
ADD CONSTRAINT image_assets_image_kind_check
CHECK (image_kind = ANY (ARRAY['eventImage'::text, 'venueLogo'::text, 'homepageImage'::text]));
