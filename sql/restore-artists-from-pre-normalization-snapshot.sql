-- Restore artists and artist links from a pre-normalization snapshot.
--
-- Use this when a destructive artist merge/delete migration was already committed.
-- This script expects snapshot tables to be preloaded in the SAME database:
--
--   restore_artists_snapshot
--     columns: id, name, slug, profile_image_url, discogs_id, musicbrainz_id, spotify_id, created_at
--
--   restore_masters_snapshot
--     columns: id, main_artist_id
--
--   restore_works_snapshot
--     columns: id, primary_artist_id
--
-- Notes:
-- 1) This restores artists by ORIGINAL ID where possible.
-- 2) This restores masters/works artist FK links back to snapshot values.
-- 3) Run inside a transaction and verify counts before COMMIT.

BEGIN;

-- Basic preflight
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'restore_artists_snapshot'
  ) THEN
    RAISE EXCEPTION 'Missing table: restore_artists_snapshot';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'restore_masters_snapshot'
  ) THEN
    RAISE EXCEPTION 'Missing table: restore_masters_snapshot';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'restore_works_snapshot'
  ) THEN
    RAISE EXCEPTION 'Missing table: restore_works_snapshot';
  END IF;
END $$;

-- Reinsert any missing artists by their original IDs.
INSERT INTO artists (
  id,
  name,
  slug,
  profile_image_url,
  discogs_id,
  musicbrainz_id,
  spotify_id,
  created_at
)
SELECT
  s.id,
  s.name,
  s.slug,
  s.profile_image_url,
  s.discogs_id,
  s.musicbrainz_id,
  s.spotify_id,
  s.created_at
FROM restore_artists_snapshot s
LEFT JOIN artists a ON a.id = s.id
WHERE a.id IS NULL;

-- Revert artist row values for IDs that still exist but were modified.
UPDATE artists a
SET
  name = s.name,
  slug = s.slug,
  profile_image_url = s.profile_image_url,
  discogs_id = s.discogs_id,
  musicbrainz_id = s.musicbrainz_id,
  spotify_id = s.spotify_id,
  created_at = s.created_at
FROM restore_artists_snapshot s
WHERE
  a.id = s.id
  AND (
    a.name IS DISTINCT FROM s.name
    OR a.slug IS DISTINCT FROM s.slug
    OR a.profile_image_url IS DISTINCT FROM s.profile_image_url
    OR a.discogs_id IS DISTINCT FROM s.discogs_id
    OR a.musicbrainz_id IS DISTINCT FROM s.musicbrainz_id
    OR a.spotify_id IS DISTINCT FROM s.spotify_id
    OR a.created_at IS DISTINCT FROM s.created_at
  );

-- Restore masters -> artists links.
UPDATE masters m
SET main_artist_id = s.main_artist_id
FROM restore_masters_snapshot s
WHERE
  m.id = s.id
  AND m.main_artist_id IS DISTINCT FROM s.main_artist_id;

-- Restore works -> artists links.
UPDATE works w
SET primary_artist_id = s.primary_artist_id
FROM restore_works_snapshot s
WHERE
  w.id = s.id
  AND w.primary_artist_id IS DISTINCT FROM s.primary_artist_id;

-- Fix artists sequence so future inserts do not collide.
SELECT setval(
  pg_get_serial_sequence('artists', 'id'),
  COALESCE((SELECT MAX(id) FROM artists), 1),
  true
);

-- Validation
SELECT COUNT(*)::int AS restored_artist_rows
FROM restore_artists_snapshot s
JOIN artists a ON a.id = s.id;

SELECT COUNT(*)::int AS masters_fk_mismatch
FROM restore_masters_snapshot s
JOIN masters m ON m.id = s.id
WHERE m.main_artist_id IS DISTINCT FROM s.main_artist_id;

SELECT COUNT(*)::int AS works_fk_mismatch
FROM restore_works_snapshot s
JOIN works w ON w.id = s.id
WHERE w.primary_artist_id IS DISTINCT FROM s.primary_artist_id;

COMMIT;
