-- restore-session-14.sql
--
-- ONE-TIME recovery for bingo session 14 (code: QFTD46).
--
-- Background
-- ----------
-- Session 14 was created before bingo_session_round_tracks and
-- bingo_session_crates existed.  The earlier rebuild-game-mirrors.sql Step 1
-- deleted its legacy "Bingo · QFTD46 Crate %" rows (those had no game_source).
-- Because both source tables were empty, Steps 2+3 produced nothing, leaving
-- the session with no game crate or playlist in the DB.
--
-- What bingo_session_calls already has
-- -------------------------------------
-- All 75 call rows survive intact (ids 1751–1825) with track metadata
-- (track_title, artist_name, album_name, side, position, ball_number,
-- column_letter).  However their playlist_track_key fields still contain
-- the old "crate:14:C:1:N" format that is no longer resolvable.
--
-- Recovery strategy
-- -----------------
-- Re-join each call against the source playlist (collection_playlist_items
-- for playlist_id = 63) via release_tracks position + side + masters.title
-- to obtain the real track_key in "inventory_id:release_track_id:recording_id"
-- format.  Then:
--
--   Step A  Build a temp table of the 75 resolved calls
--   Step B  Assert exactly 75 resolved (abort transaction otherwise)
--   Step C  Patch bingo_session_calls.playlist_track_key to real keys
--   Step D  Populate bingo_session_round_tracks  (round 1, 75 rows)
--   Step E  Populate bingo_session_crates        (round 1, crate A, call_order JSONB)
--   Step F  Create Game Crate mirror             (crates + crate_items)
--   Step G  Create Game Playlist mirror          (collection_playlists + collection_playlist_items)
--
-- Run this script ONCE.  All steps are idempotent: re-running is safe.

BEGIN;

-- ============================================================
-- Step A: Resolve real track_keys into a temp table
-- ============================================================
-- Join bingo_session_calls (session 14) → collection_playlist_items (playlist 63)
-- → inventory → releases → masters (album match) → release_tracks (pos/side match).
--
-- Key design choice: we do NOT rely on the second segment of cpi.track_key being a
-- release_track id.  Playlist 63 likely uses two-part "inventory_id:position" keys
-- (e.g. "12345:A1") where the second part is not numeric, which is why the previous
-- version matched only 1 row.  Instead we look up the release_track inside the
-- matched release by position + side — format-agnostic.
--
-- DISTINCT ON (sc.id) keeps one match per call if the same album/track appears
-- in multiple inventory copies.  A secondary ORDER BY cpi.sort_order prefers
-- whichever copy was earlier in the source playlist.
-- ============================================================
CREATE TEMP TABLE _s14_resolved ON COMMIT DROP AS
SELECT DISTINCT ON (sc.id)
  sc.id                                                   AS call_id,
  sc.call_index,
  sc.ball_number,
  sc.column_letter,
  sc.track_title,
  sc.artist_name,
  sc.album_name,
  sc.side,
  sc.position,
  sc.status,
  cpi.track_key                                           AS real_track_key,
  split_part(cpi.track_key, ':', 1)::bigint               AS inventory_id
FROM public.bingo_session_calls sc
JOIN public.collection_playlist_items cpi
  ON  cpi.playlist_id = 63
  AND split_part(cpi.track_key, ':', 1) ~ '^\d+$'      -- inventory_id must be numeric
JOIN public.inventory inv
  ON  inv.id = split_part(cpi.track_key, ':', 1)::bigint
JOIN public.releases rel
  ON  rel.id = inv.release_id
JOIN public.masters m
  ON  m.id = rel.master_id
  AND m.title = sc.album_name                            -- album title match
JOIN public.release_tracks rt
  ON  rt.release_id = rel.id                            -- scan within the release (not via key segment)
  AND UPPER(REPLACE(COALESCE(rt.position, ''), ' ', ''))
    = UPPER(REPLACE(COALESCE(sc.position, ''), ' ', ''))  -- normalised position match
  AND COALESCE(rt.side, '') = COALESCE(sc.side, '')     -- side: NULL == NULL
WHERE sc.session_id = 14
ORDER BY sc.id, cpi.sort_order;

-- ============================================================
-- Step B: Safety check — abort if not all 75 calls resolved
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _s14_resolved;
  IF v_count <> 75 THEN
    RAISE EXCEPTION
      'restore-session-14: expected 75 resolved calls, got %.  '
      'Check that all tracks in bingo_session_calls (session 14) still '
      'exist in collection_playlist_items for playlist 63.',
      v_count;
  END IF;
END$$;

-- ============================================================
-- Step C: Patch bingo_session_calls with real track keys
-- ============================================================
UPDATE public.bingo_session_calls sc
SET    playlist_track_key = r.real_track_key
FROM   _s14_resolved r
WHERE  sc.id = r.call_id;

-- ============================================================
-- Step D: Populate bingo_session_round_tracks for session 14
-- ============================================================
-- slot_index = sequential 1-based position in call order.
-- source_playlist_id = 63 (the playlist this session was built from).
-- ON CONFLICT DO NOTHING makes the step idempotent.
-- ============================================================
INSERT INTO public.bingo_session_round_tracks
  (session_id, round_number, slot_index, playlist_track_key,
   source_playlist_id, track_title, artist_name, album_name, side, position)
SELECT
  14,
  1,
  ROW_NUMBER() OVER (ORDER BY call_index)::int,
  real_track_key,
  63,
  track_title,
  artist_name,
  album_name,
  side,
  position
FROM _s14_resolved
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step E: Populate bingo_session_crates for session 14
-- ============================================================
-- Creates ONE crate row (round 1, letter A) whose call_order JSONB is the
-- full ordered array of CrateCallEntry objects, matching the TypeScript type.
-- ON CONFLICT DO NOTHING uses the UNIQUE(session_id, round_number, crate_letter)
-- constraint to make this step idempotent.
-- ============================================================
INSERT INTO public.bingo_session_crates
  (session_id, round_number, crate_name, crate_letter, call_order)
SELECT
  14,
  1,
  'QFTD46 Crate A',
  'A',
  jsonb_agg(
    jsonb_build_object(
      'id',                 call_id,
      'call_index',         call_index,
      'playlist_track_key', real_track_key,
      'ball_number',        ball_number,
      'column_letter',      column_letter,
      'track_title',        track_title,
      'artist_name',        artist_name,
      'album_name',         album_name,
      'side',               side,
      'position',           position,
      'status',             status
    )
    ORDER BY call_index
  )
FROM _s14_resolved
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step F: Game Crate mirror  (crates + crate_items)
-- ============================================================
-- Creates "Bingo QFTD46" in the collection crates table with one crate_item
-- per unique track.  If the crate already exists the INSERT produces 0 rows
-- and the crate_items INSERT skips (CROSS JOIN on empty set = 0 rows).
-- ============================================================
WITH
  new_crate AS (
    INSERT INTO public.crates
      (name, icon, color, is_smart, smart_rules, match_rules,
       live_update, sort_order, game_source)
    SELECT
      'Bingo QFTD46',
      '🎯',
      '#f59e0b',
      false,
      null,
      'all',
      false,
      COALESCE((SELECT MAX(sort_order) FROM public.crates), -1) + 1,
      'bingo'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.crates
      WHERE name = 'Bingo QFTD46' AND is_smart = false
    )
    RETURNING id
  )
INSERT INTO public.crate_items (crate_id, inventory_id, track_key)
SELECT DISTINCT ON (r.real_track_key)
  nc.id,
  r.inventory_id,
  r.real_track_key
FROM new_crate nc
CROSS JOIN _s14_resolved r;

-- ============================================================
-- Step G: Game Playlist mirror  (collection_playlists + collection_playlist_items)
-- ============================================================
-- Creates "Bingo QFTD46 Playlist A" with items ordered by call_index.
-- Same guard pattern: if the playlist already exists the inner INSERT
-- produces 0 rows and the items INSERT inserts nothing.
-- ============================================================
WITH
  new_playlist AS (
    INSERT INTO public.collection_playlists
      (name, icon, color, is_smart, smart_rules, match_rules,
       live_update, sort_order)
    SELECT
      'Bingo QFTD46 Playlist A',
      '▶️',
      '#f59e0b',
      false,
      null,
      'all',
      false,
      COALESCE((SELECT MAX(sort_order) FROM public.collection_playlists), -1) + 1
    WHERE NOT EXISTS (
      SELECT 1 FROM public.collection_playlists
      WHERE name = 'Bingo QFTD46 Playlist A'
    )
    RETURNING id
  )
INSERT INTO public.collection_playlist_items (playlist_id, track_key, sort_order)
SELECT
  np.id,
  r.real_track_key,
  r.call_index
FROM new_playlist np
CROSS JOIN _s14_resolved r;

COMMIT;
