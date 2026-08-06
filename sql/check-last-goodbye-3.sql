-- Broader check: any item in playlist 30 whose track_key starts with one of
-- the three Jeff Buckley inventory ids, in any key format.
SELECT cpi.*
FROM public.collection_playlist_items cpi
WHERE cpi.playlist_id = 30
  AND (
    cpi.track_key LIKE '1317:%'
    OR cpi.track_key LIKE '553:%'
    OR cpi.track_key LIKE '971:%'
  );

-- Also: how many items does playlist 30 actually have right now, full list,
-- so we can see everything that IS there rather than guess.
SELECT sort_order, track_key, display_title
FROM public.collection_playlist_items
WHERE playlist_id = 30
ORDER BY sort_order;
