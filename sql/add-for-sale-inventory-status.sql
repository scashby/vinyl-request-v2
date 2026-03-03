-- Allow Discogs Sale folder imports to persist status = 'for_sale'
-- Safe to run multiple times.

BEGIN;

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_status_check;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_status_check CHECK (
    status = ANY (ARRAY[
      'active'::text,
      'for_sale'::text,
      'sold'::text,
      'wishlist'::text,
      'incoming'::text
    ])
  );

COMMIT;
