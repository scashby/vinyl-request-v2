-- Add canonical Discogs folder identity columns and extended Discogs enrichment fields.
-- Idempotent migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- Inventory: Discogs identity + folder source-of-truth
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS discogs_instance_id bigint,
  ADD COLUMN IF NOT EXISTS discogs_folder_id bigint,
  ADD COLUMN IF NOT EXISTS discogs_folder_name text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inventory
    WHERE discogs_instance_id IS NOT NULL
    GROUP BY discogs_instance_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Skipping unique index creation for inventory.discogs_instance_id because duplicate values exist. Run cleanup first, then create the index.';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'inventory_discogs_instance_id_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX inventory_discogs_instance_id_unique_idx
      ON public.inventory (discogs_instance_id)
      WHERE discogs_instance_id IS NOT NULL;
  END IF;
END $$;

-- Keep status constraint canonical everywhere.
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_status_check;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_status_check CHECK (
    status = ANY (
      ARRAY[
        'active'::text,
        'for_sale'::text,
        'sold'::text,
        'wishlist'::text,
        'incoming'::text
      ]
    )
  );

-- Compatibility backfill for legacy rows that were marked as Sale in location.
UPDATE public.inventory
SET status = 'for_sale'
WHERE (status IS NULL OR status <> 'for_sale')
  AND lower(trim(coalesce(location, ''))) IN ('sale', 'for sale');

-- ---------------------------------------------------------------------------
-- Releases: targeted Discogs enrichment columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS pressing_plant text,
  ADD COLUMN IF NOT EXISTS discogs_companies jsonb,
  ADD COLUMN IF NOT EXISTS discogs_identifiers jsonb,
  ADD COLUMN IF NOT EXISTS discogs_formats jsonb;

COMMIT;
