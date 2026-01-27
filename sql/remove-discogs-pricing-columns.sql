ALTER TABLE collection
  DROP COLUMN IF EXISTS discogs_price_min,
  DROP COLUMN IF EXISTS discogs_price_median,
  DROP COLUMN IF EXISTS discogs_price_max,
  DROP COLUMN IF EXISTS discogs_price_updated_at;
