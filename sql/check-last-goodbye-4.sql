-- Find the CURRENT "90s 1" playlist id (not assuming it's still 30)
SELECT id, name, created_at FROM public.collection_playlists WHERE name = '90s 1' ORDER BY created_at DESC;

-- Check that current playlist for any Jeff Buckley "Last Goodbye" track_key
SELECT cpi.*
FROM public.collection_playlist_items cpi
JOIN public.collection_playlists cp ON cp.id = cpi.playlist_id
WHERE cp.name = '90s 1'
  AND (
    cpi.track_key LIKE '1317:%'
    OR cpi.track_key LIKE '553:%'
    OR cpi.track_key LIKE '971:%'
  );

-- Full current item count/list for that playlist
SELECT cp.id AS playlist_id, count(cpi.id) AS item_count
FROM public.collection_playlists cp
LEFT JOIN public.collection_playlist_items cpi ON cpi.playlist_id = cp.id
WHERE cp.name = '90s 1'
GROUP BY cp.id;
