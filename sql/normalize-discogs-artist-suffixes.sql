-- WARNING: DESTRUCTIVE SCRIPT
-- This script rewires artist foreign keys and deletes artist rows.
-- Do not run without a verified backup / PITR plan.

BEGIN;

SELECT
  COUNT(*)::int AS artists_with_discogs_suffix_before
FROM artists
WHERE name ~ '\s+\(\d+\)\s*$';

CREATE TEMP TABLE _discogs_suffix_artists AS
SELECT
  a.id AS artist_id,
  a.name AS original_name,
  TRIM(REGEXP_REPLACE(a.name, '\s+\(\d+\)\s*$', '')) AS cleaned_name
FROM artists a
WHERE a.name ~ '\s+\(\d+\)\s*$';

CREATE TEMP TABLE _artist_canonical AS
SELECT
  s.cleaned_name,
  (
    SELECT a2.id
    FROM artists a2
    WHERE LOWER(TRIM(REGEXP_REPLACE(a2.name, '\s+\(\d+\)\s*$', ''))) = LOWER(s.cleaned_name)
    ORDER BY
      CASE WHEN a2.name ~ '\s+\(\d+\)\s*$' THEN 1 ELSE 0 END,
      a2.id
    LIMIT 1
  ) AS canonical_artist_id
FROM _discogs_suffix_artists s
GROUP BY s.cleaned_name;

DELETE FROM _artist_canonical WHERE canonical_artist_id IS NULL;

CREATE TEMP TABLE _artist_merge_map AS
SELECT DISTINCT
  a.id AS source_artist_id,
  c.canonical_artist_id,
  c.cleaned_name
FROM _artist_canonical c
JOIN artists a
  ON LOWER(TRIM(REGEXP_REPLACE(a.name, '\s+\(\d+\)\s*$', ''))) = LOWER(c.cleaned_name)
WHERE
  a.name ~ '\s+\(\d+\)\s*$'
  OR LOWER(a.name) = LOWER(c.cleaned_name);

SELECT
  COUNT(*)::int AS artist_rows_in_merge_map,
  COUNT(*) FILTER (WHERE source_artist_id <> canonical_artist_id)::int AS artist_rows_to_merge
FROM _artist_merge_map;

UPDATE masters m
SET main_artist_id = map.canonical_artist_id
FROM _artist_merge_map map
WHERE
  m.main_artist_id = map.source_artist_id
  AND map.source_artist_id <> map.canonical_artist_id;

UPDATE works w
SET primary_artist_id = map.canonical_artist_id
FROM _artist_merge_map map
WHERE
  w.primary_artist_id = map.source_artist_id
  AND map.source_artist_id <> map.canonical_artist_id;

UPDATE artists a
SET name = c.cleaned_name
FROM _artist_canonical c
WHERE
  a.id = c.canonical_artist_id
  AND a.name IS DISTINCT FROM c.cleaned_name;

DELETE FROM artists a
USING _artist_merge_map map
WHERE
  a.id = map.source_artist_id
  AND map.source_artist_id <> map.canonical_artist_id;

WITH normalized_wantlist AS (
  SELECT
    id,
    TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(artist, '\s+\(\d+\)\s*$', ''),
        '\s+and\s+',
        ' & ',
        'gi'
      )
    ) AS cleaned_artist,
    LOWER(TRIM(COALESCE(title, ''))) AS cleaned_title
  FROM wantlist
)
UPDATE wantlist w
SET
  artist = n.cleaned_artist,
  artist_norm = LOWER(n.cleaned_artist),
  title_norm = n.cleaned_title,
  artist_album_norm = CONCAT_WS(' ', LOWER(n.cleaned_artist), n.cleaned_title)
FROM normalized_wantlist n
WHERE
  w.id = n.id
  AND (
    w.artist IS DISTINCT FROM n.cleaned_artist
    OR w.artist_norm IS DISTINCT FROM LOWER(n.cleaned_artist)
    OR w.title_norm IS DISTINCT FROM n.cleaned_title
    OR w.artist_album_norm IS DISTINCT FROM CONCAT_WS(' ', LOWER(n.cleaned_artist), n.cleaned_title)
  );

SELECT
  COUNT(*)::int AS artists_with_discogs_suffix_after
FROM artists
WHERE name ~ '\s+\(\d+\)\s*$';

COMMIT;
