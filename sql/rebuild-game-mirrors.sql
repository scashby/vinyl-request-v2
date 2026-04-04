-- Rebuild Game Crate and Game Playlist mirrors for all Bingo sessions.
--
-- Step 1: Remove legacy album-level crate mirrors created by the pre-Rev3
--         ensureCollectionCrateMirror helper.  These were named
--         "Bingo · <sessionCode> Crate <letter>" and had no game_source set.
--
-- Step 2: Create one Game Crate per unique (session, round) from
--         bingo_session_round_tracks, with one crate_item per track.
--         track_key  = playlist_track_key (e.g. "12:34:56")
--         inventory_id = first segment of track_key cast to bigint
--
-- Step 3: Create one Game Playlist per bingo_session_crates row from the
--         stored call_order JSONB, with one collection_playlist_item per
--         call entry, ordered by call_index.

BEGIN;

-- ============================================================
-- Step 1: Delete legacy album-level game crate mirrors
-- ============================================================
DELETE FROM public.crates
WHERE name LIKE 'Bingo · %'
  AND game_source IS NULL;

-- ============================================================
-- Step 2: Game Crate mirrors
-- ============================================================
WITH
  next_crate_sort AS (
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM public.crates
  ),
  rounds AS (
    SELECT DISTINCT
      t.session_id,
      t.round_number,
      s.session_code,
      ROW_NUMBER() OVER (ORDER BY t.session_id, t.round_number) AS rn
    FROM public.bingo_session_round_tracks t
    JOIN public.bingo_sessions s ON s.id = t.session_id
  ),
  new_crates AS (
    INSERT INTO public.crates
      (name, icon, color, is_smart, smart_rules, match_rules, live_update, sort_order, game_source)
    SELECT
      'Bingo ' || r.session_code || ' Round ' || r.round_number,
      '🎯',
      '#f59e0b',
      false,
      null,
      'all',
      false,
      (SELECT max_sort FROM next_crate_sort) + r.rn,
      'bingo'
    FROM rounds r
    RETURNING id, name
  ),
  crate_map AS (
    SELECT
      nc.id AS crate_id,
      r.session_id,
      r.round_number
    FROM new_crates nc
    JOIN rounds r
      ON nc.name = 'Bingo ' || r.session_code || ' Round ' || r.round_number
  )
INSERT INTO public.crate_items (crate_id, inventory_id, track_key)
SELECT
  cm.crate_id,
  split_part(t.playlist_track_key, ':', 1)::bigint,
  t.playlist_track_key
FROM public.bingo_session_round_tracks t
JOIN crate_map cm
  ON cm.session_id = t.session_id AND cm.round_number = t.round_number;

-- ============================================================
-- Step 3: Game Playlist mirrors
-- ============================================================
WITH
  next_playlist_sort AS (
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM public.collection_playlists
  ),
  crate_info AS (
    SELECT
      bsc.id          AS session_crate_id,
      bsc.session_id,
      bsc.crate_letter,
      bsc.call_order,
      s.session_code,
      'Bingo ' || s.session_code || ' Playlist ' || bsc.crate_letter AS playlist_name,
      ROW_NUMBER() OVER (ORDER BY bsc.session_id, bsc.crate_letter) AS rn
    FROM public.bingo_session_crates bsc
    JOIN public.bingo_sessions s ON s.id = bsc.session_id
  ),
  new_playlists AS (
    INSERT INTO public.collection_playlists
      (name, icon, color, is_smart, smart_rules, match_rules, live_update, sort_order)
    SELECT
      ci.playlist_name,
      '▶️',
      '#f59e0b',
      false,
      null,
      'all',
      false,
      (SELECT max_sort FROM next_playlist_sort) + ci.rn
    FROM crate_info ci
    RETURNING id, name
  ),
  playlist_map AS (
    SELECT
      np.id       AS playlist_id,
      ci.call_order
    FROM new_playlists np
    JOIN crate_info ci ON ci.playlist_name = np.name
  )
INSERT INTO public.collection_playlist_items (playlist_id, track_key, sort_order)
SELECT
  pm.playlist_id,
  elem->>'playlist_track_key',
  (elem->>'call_index')::int
FROM playlist_map pm,
     jsonb_array_elements(pm.call_order) AS elem
WHERE (elem->>'playlist_track_key') IS NOT NULL
  AND (elem->>'playlist_track_key') <> '';

COMMIT;
