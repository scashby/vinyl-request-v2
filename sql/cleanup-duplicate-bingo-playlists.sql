-- cleanup-duplicate-bingo-playlists.sql
--
-- Removes duplicate collection_playlists rows created by accidental
-- double-runs of rebuild-game-mirrors.sql for bingo sessions.
--
-- Strategy: for any playlist name that appears more than once, keep the
-- copy with the highest item count (most entries). If two copies have the
-- same count, keep the one created first (lowest id).
-- ALL items belonging to deleted duplicates are removed via CASCADE.
--
-- Safe to run multiple times (the DELETE is a no-op if duplicates are gone).

BEGIN;

-- Show what will be deleted before committing (review this output first).
SELECT
  id,
  name,
  (SELECT COUNT(*) FROM public.collection_playlist_items WHERE playlist_id = cp.id) AS item_count,
  'WILL DELETE' AS action
FROM public.collection_playlists cp
WHERE name LIKE 'Bingo %'
  AND id NOT IN (
    -- Keep the "best" copy of each duplicate name
    SELECT DISTINCT ON (name) id
    FROM public.collection_playlists
    WHERE name LIKE 'Bingo %'
    ORDER BY
      name,
      (SELECT COUNT(*) FROM public.collection_playlist_items WHERE playlist_id = id) DESC,
      id ASC
  )
ORDER BY name, id;

-- Delete items first (in case no CASCADE is set), then the playlist rows.
DELETE FROM public.collection_playlist_items
WHERE playlist_id IN (
  SELECT id
  FROM public.collection_playlists
  WHERE name LIKE 'Bingo %'
    AND id NOT IN (
      SELECT DISTINCT ON (name) id
      FROM public.collection_playlists
      WHERE name LIKE 'Bingo %'
      ORDER BY
        name,
        (SELECT COUNT(*) FROM public.collection_playlist_items WHERE playlist_id = id) DESC,
        id ASC
    )
);

DELETE FROM public.collection_playlists
WHERE name LIKE 'Bingo %'
  AND id NOT IN (
    SELECT DISTINCT ON (name) id
    FROM public.collection_playlists
    WHERE name LIKE 'Bingo %'
    ORDER BY
      name,
      (SELECT COUNT(*) FROM public.collection_playlist_items WHERE playlist_id = id) DESC,
      id ASC
  );

COMMIT;
