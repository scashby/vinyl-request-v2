-- Read-only. Finds release_tracks rows that share the same (release_id, position),
-- which collide when building track_key = "<inventory_id>:<position>".

SELECT
  rt.release_id,
  rt.position,
  rt.side,
  rt.id AS release_track_id,
  COALESCE(rt.title_override, r.title) AS title,
  a.name AS artist
FROM public.release_tracks rt
JOIN public.recordings r ON r.id = rt.recording_id
LEFT JOIN public.releases rel ON rel.id = rt.release_id
LEFT JOIN public.masters m ON m.id = rel.master_id
LEFT JOIN public.artists a ON a.id = m.main_artist_id
WHERE rt.release_id IN (
  SELECT rt2.release_id
  FROM public.release_tracks rt2
  GROUP BY rt2.release_id, rt2.position
  HAVING count(*) > 1
)
ORDER BY rt.release_id, rt.position;
