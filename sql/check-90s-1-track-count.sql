-- Read-only. Checks for the ground truth behind the "75 -> 73" mismatch:
-- are there actually two different playlist rows both named "90s 1"?

SELECT
  cp.id AS playlist_id,
  cp.name,
  cp.created_at,
  count(cpi.id) AS item_count,
  count(DISTINCT cpi.track_key) AS distinct_track_key_count
FROM public.collection_playlists cp
LEFT JOIN public.collection_playlist_items cpi ON cpi.playlist_id = cp.id
WHERE cp.name = '90s 1'
GROUP BY cp.id, cp.name, cp.created_at
ORDER BY cp.created_at;
