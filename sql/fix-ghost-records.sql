-- Investigate ghost inventory records: inventory rows whose release has no master or no artist.
-- These appear as "Unknown Artist / Untitled" in the collection browser.
-- Run the SELECT first to confirm what will be deleted.

SELECT
  i.id               AS inventory_id,
  i.status,
  i.discogs_instance_id,
  r.id               AS release_id,
  r.media_type,
  r.discogs_release_id,
  r.master_id,
  m.title            AS master_title,
  a.name             AS artist_name
FROM inventory i
JOIN releases r ON r.id = i.release_id
LEFT JOIN masters m ON m.id = r.master_id
LEFT JOIN artists a ON a.id = m.main_artist_id
WHERE m.id IS NULL OR m.title IS NULL OR a.id IS NULL
ORDER BY r.media_type, i.id;


-- ─── DELETE (run after confirming the SELECT above) ─────────────────────────
-- Deletes inventory rows where the linked release has no resolvable master/artist.
-- Replace the media_type IN list if needed to target only the specific ghost types.

/*
DELETE FROM inventory
WHERE id IN (
  SELECT i.id
  FROM inventory i
  JOIN releases r ON r.id = i.release_id
  LEFT JOIN masters m ON m.id = r.master_id
  LEFT JOIN artists a ON a.id = m.main_artist_id
  WHERE (m.id IS NULL OR m.title IS NULL OR a.id IS NULL)
    AND r.media_type IN ('All Media', 'Flexi-disc', 'SACD')
)
RETURNING id, release_id, status;
*/
