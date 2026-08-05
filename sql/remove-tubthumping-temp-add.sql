-- Shows what will be removed, then deletes it from public.inventory
-- (your owned-copy table). Does not touch the shared releases/masters/
-- recordings catalog rows, only your inventory ownership record(s).

SELECT
  inv.id AS inventory_id,
  inv.status,
  m.title AS master_title,
  a.name AS artist,
  'WILL DELETE' AS action
FROM public.inventory inv
JOIN public.releases rel ON rel.id = inv.release_id
JOIN public.masters m ON m.id = rel.master_id
LEFT JOIN public.artists a ON a.id = m.main_artist_id
WHERE m.title ILIKE '%tubthump%'
   OR a.name ILIKE '%chumbawamba%';

DELETE FROM public.inventory
WHERE release_id IN (
  SELECT rel.id
  FROM public.releases rel
  JOIN public.masters m ON m.id = rel.master_id
  LEFT JOIN public.artists a ON a.id = m.main_artist_id
  WHERE m.title ILIKE '%tubthump%'
     OR a.name ILIKE '%chumbawamba%'
);
