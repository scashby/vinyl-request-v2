-- Phase 1 (non-destructive): normalize Discogs numeric suffixes where safe.
-- No row deletes. No FK rewires. No table/column drops.
-- Conflicting artist groups are reported and skipped for manual review.

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

-- Safe renames are only rows with no normalized-name collisions.
CREATE TEMP TABLE _artist_safe_rename AS
SELECT
  s.artist_id,
  s.original_name,
  s.cleaned_name
FROM _discogs_suffix_artists s
WHERE NOT EXISTS (
  SELECT 1
  FROM artists a2
  WHERE
    a2.id <> s.artist_id
    AND LOWER(TRIM(REGEXP_REPLACE(a2.name, '\s+\(\d+\)\s*$', ''))) = LOWER(s.cleaned_name)
);

CREATE TEMP TABLE _artist_conflicts AS
SELECT
  s.cleaned_name,
  ARRAY_AGG(s.artist_id ORDER BY s.artist_id) AS artist_ids,
  ARRAY_AGG(s.original_name ORDER BY s.artist_id) AS artist_names
FROM _discogs_suffix_artists s
WHERE EXISTS (
  SELECT 1
  FROM artists a2
  WHERE
    a2.id <> s.artist_id
    AND LOWER(TRIM(REGEXP_REPLACE(a2.name, '\s+\(\d+\)\s*$', ''))) = LOWER(s.cleaned_name)
)
GROUP BY s.cleaned_name;

SELECT
  (SELECT COUNT(*) FROM _discogs_suffix_artists)::int AS suffixed_artist_rows_found,
  (SELECT COUNT(*) FROM _artist_safe_rename)::int AS safe_artist_rows_to_rename,
  (SELECT COUNT(*) FROM _artist_conflicts)::int AS conflicting_name_groups_skipped;

SELECT
  cleaned_name,
  artist_ids,
  artist_names
FROM _artist_conflicts
ORDER BY cleaned_name
LIMIT 50;

WITH updated AS (
  UPDATE artists a
  SET name = s.cleaned_name
  FROM _artist_safe_rename s
  WHERE
    a.id = s.artist_id
    AND a.name IS DISTINCT FROM s.cleaned_name
  RETURNING a.id
)
SELECT COUNT(*)::int AS artists_renamed_without_merge
FROM updated;

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
),
updated AS (
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
    )
  RETURNING w.id
)
SELECT COUNT(*)::int AS wantlist_rows_normalized
FROM updated;

WITH normalized_recordings AS (
  SELECT
    r.id,
    NULLIF(TRIM(REGEXP_REPLACE(COALESCE(r.track_artist, ''), '\s+\(\d+\)\s*$', '')), '') AS cleaned_track_artist,
    CASE
      WHEN jsonb_typeof(r.credits) = 'object'
        THEN NULLIF(
          TRIM(
            REGEXP_REPLACE(
              COALESCE(r.credits ->> 'track_artist', ''),
              '\s+\(\d+\)\s*$',
              ''
            )
          ),
          ''
        )
      ELSE NULL
    END AS cleaned_credit_track_artist,
    r.credits
  FROM recordings r
),
updated AS (
  UPDATE recordings r
  SET
    track_artist = n.cleaned_track_artist,
    credits = CASE
      WHEN jsonb_typeof(n.credits) <> 'object' THEN n.credits
      WHEN n.cleaned_credit_track_artist IS NULL THEN n.credits - 'track_artist'
      ELSE jsonb_set(n.credits, '{track_artist}', to_jsonb(n.cleaned_credit_track_artist), true)
    END
  FROM normalized_recordings n
  WHERE
    r.id = n.id
    AND (
      r.track_artist IS DISTINCT FROM n.cleaned_track_artist
      OR (
        jsonb_typeof(n.credits) = 'object'
        AND (
          (n.cleaned_credit_track_artist IS NULL AND (n.credits ? 'track_artist'))
          OR (n.cleaned_credit_track_artist IS NOT NULL AND (n.credits ->> 'track_artist') IS DISTINCT FROM n.cleaned_credit_track_artist)
        )
      )
    )
  RETURNING r.id
)
SELECT COUNT(*)::int AS recordings_rows_normalized
FROM updated;

SELECT
  COUNT(*)::int AS artists_with_discogs_suffix_after
FROM artists
WHERE name ~ '\s+\(\d+\)\s*$';

COMMIT;
