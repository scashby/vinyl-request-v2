SELECT
  rt.id AS release_track_id,
  rt.release_id,
  rt.position,
  rt.side,
  rt.title_override,
  r.id AS recording_id,
  r.title AS recording_title,
  r.track_artist
FROM public.release_tracks rt
LEFT JOIN public.recordings r ON r.id = rt.recording_id
WHERE rt.release_id = 3538
ORDER BY rt.position;
