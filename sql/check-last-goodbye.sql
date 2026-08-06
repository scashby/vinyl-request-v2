-- Does "Last Goodbye" by Jeff Buckley exist in inventory at all, and under what track_key?
SELECT
  inv.id AS inventory_id,
  rt.id AS release_track_id,
  rt.release_id,
  rt.position,
  rt.side,
  rt.title_override,
  r.title AS recording_title,
  r.track_artist,
  m.title AS album_title,
  a.name AS album_artist,
  inv.id || ':' || rt.position AS would_be_track_key
FROM public.release_tracks rt
JOIN public.recordings r ON r.id = rt.recording_id
JOIN public.releases rel ON rel.id = rt.release_id
JOIN public.masters m ON m.id = rel.master_id
LEFT JOIN public.artists a ON a.id = m.main_artist_id
JOIN public.inventory inv ON inv.release_id = rel.id
WHERE r.title ILIKE '%last goodbye%'
   OR (a.name ILIKE '%buckley%' AND m.title ILIKE '%grace%');

-- Is that track_key actually sitting in the "90s 1" playlist (id 30) right now?
SELECT cpi.*
FROM public.collection_playlist_items cpi
WHERE cpi.playlist_id = 30
  AND cpi.track_key IN (
    SELECT inv.id || ':' || rt.position
    FROM public.release_tracks rt
    JOIN public.recordings r ON r.id = rt.recording_id
    JOIN public.inventory inv ON inv.release_id = rt.release_id
    WHERE r.title ILIKE '%last goodbye%'
  );
