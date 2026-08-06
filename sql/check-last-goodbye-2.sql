SELECT cpi.*
FROM public.collection_playlist_items cpi
WHERE cpi.playlist_id = 30
  AND cpi.track_key IN ('1317:6', '553:3', '971:A3');
