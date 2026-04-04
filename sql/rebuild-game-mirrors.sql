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
-- Step 2: Game Crate mirrors (ONE per session)
-- ============================================================
-- The crate is the pull list: every unique track the host needs to have
-- physically available across ALL rounds of the session, deduplicated.
WITH
  next_crate_sort AS (
    SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM public.crates
  ),
  sessions AS (
    SELECT
      s.id   AS session_id,
      s.session_code,
      ROW_NUMBER() OVER (ORDER BY s.id) AS rn
    FROM public.bingo_sessions s
    WHERE EXISTS (
      SELECT 1 FROM public.bingo_session_round_tracks t WHERE t.session_id = s.id
    )
  ),
  new_crates AS (
    INSERT INTO public.crates
      (name, icon, color, is_smart, smart_rules, match_rules, live_update, sort_order, game_source)
    SELECT
      'Bingo ' || ses.session_code,
      '🎯',
      '#f59e0b',
      false,
      null,
      'all',
      false,
      (SELECT max_sort FROM next_crate_sort) + ses.rn,
      'bingo'
    FROM sessions ses
    RETURNING id, name
  ),
  crate_map AS (
    SELECT
      nc.id      AS crate_id,
      ses.session_id
    FROM new_crates nc
    JOIN sessions ses ON nc.name = 'Bingo ' || ses.session_code
  )
INSERT INTO public.crate_items (crate_id, inventory_id, track_key)
SELECT DISTINCT ON (cm.crate_id, t.playlist_track_key)
  cm.crate_id,
  split_part(t.playlist_track_key, ':', 1)::bigint,
  t.playlist_track_key
FROM public.bingo_session_round_tracks t
JOIN crate_map cm ON cm.session_id = t.session_id;

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
