-- Fix inventory records where location or discogs_folder_name was stored as 'V'
-- instead of 'Vinyl' during Discogs import.
UPDATE inventory
SET
  location = 'Vinyl',
  discogs_folder_name = CASE WHEN discogs_folder_name = 'V' THEN 'Vinyl' ELSE discogs_folder_name END
WHERE location = 'V';
