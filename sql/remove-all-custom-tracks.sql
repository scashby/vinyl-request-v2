-- Removes every existing "custom track" add (is_custom = true on releases)
-- from public.inventory. These are the one-off tracks created via
-- "Add Custom Track" during import that were never backed by a real
-- owned release. The code fix stops NEW ones from being matched going
-- forward; this clears out the ones that already exist so they go back
-- to needing to be re-added/re-resolved on the next import.

SELECT
  inv.id AS inventory_id,
  rel.id AS release_id,
  m.title AS master_title,
  a.name AS artist,
  'WILL DELETE' AS action
FROM public.inventory inv
JOIN public.releases rel ON rel.id = inv.release_id
JOIN public.masters m ON m.id = rel.master_id
LEFT JOIN public.artists a ON a.id = m.main_artist_id
WHERE rel.is_custom = true;

DELETE FROM public.inventory
WHERE release_id IN (
  SELECT id FROM public.releases WHERE is_custom = true
);
