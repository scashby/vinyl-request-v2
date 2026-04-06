-- fix-bingo-playlist-naming.sql
--
-- Two problems fixed here, both using RENAME rather than delete+re-create
-- so no track items are lost:
--
-- 1. collection_playlists rows created by legacy code used the name format:
--       "Bingo {sessionCode} Playlist {letter}"   (e.g. "Bingo QFTD46 Playlist A")
--    Current code uses:
--       "{sessionCode} Playlist {animalName}"     (e.g. "QFTD46 Playlist Fox")
--    The old rows are renamed in-place; their items are preserved.
--    The sync code looks up collection entries by name, so after renaming it
--    will find and update these existing rows instead of creating duplicates.
--
-- 2. bingo_session_game_playlists.playlist_name stores the same legacy format.
--    Updated to match so the stored value is consistent with displayed names.
--
-- Mapping used: A→Fox, B→Owl, C→Bear, D→Wolf, E→Hawk, F→Elk, G→Crow,
--   H→Deer, I→Seal, J→Wren, K→Crane, L→Heron, M→Stork, N→Robin, O→Swift,
--   P→Falcon, Q→Eagle, R→Dove, S→Otter, T→Whale, U→Beaver, V→Badger,
--   W→Moose, X→Bison, Y→Cobra, Z→Gecko.
--
-- After Step 1 the old "Bingo" entries become {sessionCode} Playlist {Animal}.
-- However an earlier sync run (before the animal-name code was deployed) already
-- created EMPTY letter-named entries ("{sessionCode} Playlist A/B/C…" with 0 items).
-- Those are deleted in Step 2 below; the populated animal-named entries are kept.
--
-- This script is fully self-contained. Steps 4–6 normalise icons, create any missing
-- collection entries and populate their track items directly from the stored
-- call_order JSONB — no sync step is required after running it.

BEGIN;

-- ----------------------------------------------------------------
-- Step 1: Rename legacy collection_playlists rows in-place.
--         Strips the "Bingo " prefix and maps the letter to an animal name.
--         Items (collection_playlist_items) are untouched.
-- ----------------------------------------------------------------
UPDATE public.collection_playlists
SET name = CONCAT(
  -- Strip the leading "Bingo " to get "{sessionCode} Playlist "
  REGEXP_REPLACE(name, '^Bingo (.+ Playlist )[A-Z]$', '\1'),
  -- Replace the trailing single letter with the animal name
  CASE SUBSTRING(name FROM '[A-Z]$')
    WHEN 'A' THEN 'Fox'    WHEN 'B' THEN 'Owl'    WHEN 'C' THEN 'Bear'
    WHEN 'D' THEN 'Wolf'   WHEN 'E' THEN 'Hawk'   WHEN 'F' THEN 'Elk'
    WHEN 'G' THEN 'Crow'   WHEN 'H' THEN 'Deer'   WHEN 'I' THEN 'Seal'
    WHEN 'J' THEN 'Wren'   WHEN 'K' THEN 'Crane'  WHEN 'L' THEN 'Heron'
    WHEN 'M' THEN 'Stork'  WHEN 'N' THEN 'Robin'  WHEN 'O' THEN 'Swift'
    WHEN 'P' THEN 'Falcon' WHEN 'Q' THEN 'Eagle'  WHEN 'R' THEN 'Dove'
    WHEN 'S' THEN 'Otter'  WHEN 'T' THEN 'Whale'  WHEN 'U' THEN 'Beaver'
    WHEN 'V' THEN 'Badger' WHEN 'W' THEN 'Moose'  WHEN 'X' THEN 'Bison'
    WHEN 'Y' THEN 'Cobra'  WHEN 'Z' THEN 'Gecko'
  END
)
WHERE name ~ '^Bingo .+ Playlist [A-Z]$';

-- ----------------------------------------------------------------
-- Step 2: Delete 0-item letter-named collection entries that were
--         created by a broken earlier sync run (e.g. "QFTD46 Playlist A").
--         Only entries whose name matches a known bingo session code and
--         which have strictly 0 track items are removed — populated entries
--         (Fox/Owl/Bear with 75 tracks) are left completely untouched.
-- ----------------------------------------------------------------
DELETE FROM public.collection_playlists
WHERE id IN (
  SELECT cp.id
  FROM public.collection_playlists cp
  -- Must end in " Playlist <single uppercase letter>"
  WHERE cp.name ~ ' Playlist [A-Z]$'
    -- Must have zero items
    AND NOT EXISTS (
      SELECT 1 FROM public.collection_playlist_items cpi
      WHERE cpi.playlist_id = cp.id
    )
    -- Must match a bingo session code so we don't accidentally
    -- remove any user-created playlist named similarly.
    AND EXISTS (
      SELECT 1
      FROM public.bingo_sessions bs
      WHERE cp.name = CONCAT(
        COALESCE(bs.session_code, bs.id::text),
        ' Playlist ',
        RIGHT(cp.name, 1)
      )
    )
);

-- ----------------------------------------------------------------
-- Step 3: Update stored playlist_name in bingo_session_game_playlists
--         for rows where playlist_letter is a single uppercase letter.
--         Joins to bingo_sessions to get the session_code for the name.
-- ----------------------------------------------------------------
UPDATE public.bingo_session_game_playlists gp
SET playlist_name = CONCAT(
  COALESCE(s.session_code, gp.session_id::text),
  ' Playlist ',
  CASE gp.playlist_letter
    WHEN 'A' THEN 'Fox'    WHEN 'B' THEN 'Owl'    WHEN 'C' THEN 'Bear'
    WHEN 'D' THEN 'Wolf'   WHEN 'E' THEN 'Hawk'   WHEN 'F' THEN 'Elk'
    WHEN 'G' THEN 'Crow'   WHEN 'H' THEN 'Deer'   WHEN 'I' THEN 'Seal'
    WHEN 'J' THEN 'Wren'   WHEN 'K' THEN 'Crane'  WHEN 'L' THEN 'Heron'
    WHEN 'M' THEN 'Stork'  WHEN 'N' THEN 'Robin'  WHEN 'O' THEN 'Swift'
    WHEN 'P' THEN 'Falcon' WHEN 'Q' THEN 'Eagle'  WHEN 'R' THEN 'Dove'
    WHEN 'S' THEN 'Otter'  WHEN 'T' THEN 'Whale'  WHEN 'U' THEN 'Beaver'
    WHEN 'V' THEN 'Badger' WHEN 'W' THEN 'Moose'  WHEN 'X' THEN 'Bison'
    WHEN 'Y' THEN 'Cobra'  WHEN 'Z' THEN 'Gecko'
    ELSE gp.playlist_letter
  END
)
FROM public.bingo_sessions s
WHERE gp.session_id = s.id
  AND gp.playlist_letter ~ '^[A-Z]$';

-- ----------------------------------------------------------------
-- Step 4: Normalise the icon on all bingo game playlist collection entries
--         so they all display consistently (dice emoji, purple tint).
--         Matches by name pattern so it catches both old renamed entries
--         and any new ones created by previous sync runs.
-- ----------------------------------------------------------------
UPDATE public.collection_playlists
SET
  icon  = '🎲',
  color = '#451a7d'
WHERE id IN (
  SELECT cp.id
  FROM public.collection_playlists cp
  JOIN public.bingo_session_game_playlists gp ON gp.playlist_name = cp.name
);

-- ----------------------------------------------------------------
-- Step 5: Create collection_playlists entries for any game playlist
--         that still has no matching entry (e.g. Wolf/Hawk/Elk/Crow
--         after the letter entries above are deleted).
--         sort_order is appended after the current maximum.
-- ----------------------------------------------------------------
INSERT INTO public.collection_playlists (name, icon, color, is_smart, match_rules, live_update, sort_order)
SELECT
  gp.playlist_name,
  '🎲',
  '#451a7d',
  false,
  'all',
  false,
  (SELECT COALESCE(MAX(sort_order), 0) FROM public.collection_playlists) + ROW_NUMBER() OVER (ORDER BY gp.id)
FROM public.bingo_session_game_playlists gp
WHERE NOT EXISTS (
  SELECT 1 FROM public.collection_playlists cp WHERE cp.name = gp.playlist_name
);

-- ----------------------------------------------------------------
-- Step 6: Populate collection_playlist_items from the call_order JSONB
--         for every collection entry that currently has 0 items.
--         Skips entries where track_key is missing/null in the JSONB
--         (legacy rows pre-dating track_key will remain empty but visible).
-- ----------------------------------------------------------------
INSERT INTO public.collection_playlist_items (playlist_id, track_key, sort_order)
SELECT
  cp.id,
  entry->>'track_key'        AS track_key,
  (ordinality)::int           AS sort_order
FROM public.collection_playlists cp
JOIN public.bingo_session_game_playlists gp ON gp.playlist_name = cp.name
CROSS JOIN LATERAL jsonb_array_elements(gp.call_order) WITH ORDINALITY AS t(entry, ordinality)
WHERE NOT EXISTS (
  SELECT 1 FROM public.collection_playlist_items WHERE playlist_id = cp.id
)
  AND (entry->>'track_key') IS NOT NULL
  AND (entry->>'track_key') <> '';

COMMIT;
