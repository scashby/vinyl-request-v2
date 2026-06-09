BEGIN;

-- One-time repair script (card-safe)
-- Target session code is hardcoded to N65WMT.
-- Run the whole script at once.
-- This does NOT regenerate playlists.
-- This does NOT delete session events or reset session status/timers.
-- It only refreshes call metadata used by cards, then rehydrates card labels.

CREATE TEMP TABLE repair_params AS
SELECT
  s.id AS session_id,
  s.session_code
FROM bingo_sessions s
WHERE upper(s.session_code) = 'N65WMT'
ORDER BY s.created_at DESC
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM repair_params) THEN
    RAISE EXCEPTION 'Session code N65WMT was not found.';
  END IF;
END $$;

CREATE TEMP TABLE repair_session AS
SELECT
  s.id,
  GREATEST(1, COALESCE(s.current_round, 1)) AS current_round,
  COALESCE(s.card_label_mode, 'track_artist') AS card_label_mode,
  s.active_playlist_letter_by_round
FROM bingo_sessions s
JOIN repair_params p ON p.session_id = s.id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM repair_session) THEN
    RAISE EXCEPTION 'Session not found.';
  END IF;
END $$;

CREATE TEMP TABLE repair_playlist_sources (
  session_id int NOT NULL,
  round_number int NOT NULL,
  playlist_letter text NOT NULL,
  call_order jsonb NOT NULL,
  created_at timestamptz,
  source_rank int NOT NULL
);

DO $$
BEGIN
  IF to_regclass('public.bingo_session_game_playlists') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO repair_playlist_sources (session_id, round_number, playlist_letter, call_order, created_at, source_rank)
      SELECT
        gp.session_id,
        gp.round_number,
        gp.playlist_letter,
        gp.call_order::jsonb,
        gp.created_at,
        0
      FROM bingo_session_game_playlists gp
    $sql$;
  END IF;

  IF to_regclass('public.bingo_session_crates') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO repair_playlist_sources (session_id, round_number, playlist_letter, call_order, created_at, source_rank)
      SELECT
        lc.session_id,
        lc.round_number,
        lc.crate_letter,
        lc.call_order::jsonb,
        lc.created_at,
        1
      FROM bingo_session_crates lc
    $sql$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM repair_playlist_sources) THEN
    RAISE EXCEPTION 'No playlist source tables found (expected bingo_session_game_playlists and/or bingo_session_crates).';
  END IF;
END $$;

CREATE TEMP TABLE repair_active_choice AS
WITH preferred_letter AS (
  SELECT
    rs.id AS session_id,
    rs.current_round,
    (
      SELECT elem->>'letter'
      FROM jsonb_array_elements(COALESCE(rs.active_playlist_letter_by_round::jsonb, '[]'::jsonb)) elem
      WHERE (elem->>'round')::int = rs.current_round
      LIMIT 1
    ) AS playlist_letter
  FROM repair_session rs
),
ranked AS (
  SELECT
    src.*,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE
          WHEN pref.playlist_letter IS NOT NULL AND src.playlist_letter = pref.playlist_letter THEN 0
          ELSE 1
        END,
        src.source_rank,
        src.created_at DESC
    ) AS pick_rank
  FROM repair_playlist_sources src
  JOIN preferred_letter pref
    ON pref.session_id = src.session_id
   AND pref.current_round = src.round_number
)
SELECT session_id, round_number, playlist_letter, call_order
FROM ranked
WHERE pick_rank = 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM repair_active_choice) THEN
    RAISE EXCEPTION 'No round playlist found for this session/current_round.';
  END IF;
END $$;

CREATE TEMP TABLE repair_new_calls AS
WITH raw AS (
  SELECT
    ord::int AS ord,
    elem AS row
  FROM repair_active_choice c
  CROSS JOIN LATERAL jsonb_array_elements(c.call_order) WITH ORDINALITY AS x(elem, ord)
),
normalized AS (
  SELECT
    ord,
    COALESCE(NULLIF(row->>'playlist_track_key', ''), NULLIF(row->>'track_key', ''), 'missing:' || ord::text) AS playlist_track_key,
    COALESCE(NULLIF((row->>'call_index')::int, 0), ord) AS call_index,
    LEAST(75, GREATEST(1, COALESCE(NULLIF((row->>'ball_number')::int, 0), ord))) AS ball_number,
    CASE
      WHEN UPPER(COALESCE(row->>'column_letter', '')) IN ('B','G','I','N','O') THEN UPPER(row->>'column_letter')
      ELSE 'B'
    END AS column_letter,
    COALESCE(row->>'track_title', '') AS track_title,
    COALESCE(row->>'artist_name', '') AS artist_name,
    NULLIF(row->>'album_name', '') AS album_name,
    NULLIF(row->>'side', '') AS side,
    NULLIF(row->>'position', '') AS position,
    NULLIF(row->>'link_group', '') AS link_group
  FROM raw
)
SELECT * FROM normalized
ORDER BY ord;

CREATE TEMP TABLE repair_existing_calls AS
SELECT
  c.id,
  ROW_NUMBER() OVER (ORDER BY c.id) AS rn
FROM bingo_session_calls c
JOIN repair_params p ON p.session_id = c.session_id
ORDER BY c.id;

DO $$
DECLARE
  existing_count int;
  new_count int;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM repair_existing_calls;
  SELECT COUNT(*) INTO new_count FROM repair_new_calls;

  IF existing_count = 0 THEN
    RAISE EXCEPTION 'Session has no bingo_session_calls rows to update.';
  END IF;

  IF existing_count <> new_count THEN
    RAISE EXCEPTION 'Call row mismatch: session has % rows, active playlist has % rows. Refusing to remap ids.', existing_count, new_count;
  END IF;
END $$;

-- Rewrite call metadata in-place so card call_id references remain valid.
-- Intentionally does NOT change call_index, ball_number, status, or call timestamps.
UPDATE bingo_session_calls c
SET
  playlist_track_key = n.playlist_track_key,
  track_title = n.track_title,
  artist_name = n.artist_name,
  album_name = n.album_name,
  side = n.side,
  position = n.position,
  link_group = n.link_group,
  metadata_locked = false,
  metadata_synced_at = NOW()
FROM repair_existing_calls e
JOIN repair_new_calls n ON n.ord = e.rn
WHERE c.id = e.id;

-- Rehydrate card labels/titles from updated call rows.
CREATE TEMP TABLE repair_card_grids AS
SELECT
  bc.id AS card_id,
  rebuilt.grid_json
FROM bingo_cards bc
JOIN repair_params p ON p.session_id = bc.session_id
JOIN repair_session rs ON rs.id = p.session_id
CROSS JOIN LATERAL (
  SELECT jsonb_agg(
           CASE
             WHEN COALESCE((cell->>'free')::boolean, false) THEN cell
             ELSE
               cell || jsonb_build_object(
                 'track_title', COALESCE(sc.track_title, cell->>'track_title', ''),
                 'artist_name', COALESCE(sc.artist_name, cell->>'artist_name', ''),
                 'label', CASE
                   WHEN rs.card_label_mode = 'track_only' THEN COALESCE(sc.track_title, cell->>'track_title', '')
                   ELSE COALESCE(sc.track_title, cell->>'track_title', '') || ' - ' || COALESCE(sc.artist_name, cell->>'artist_name', '')
                 END
               )
           END
           ORDER BY ord
         ) AS grid_json
  FROM jsonb_array_elements(bc.grid::jsonb) WITH ORDINALITY AS cells(cell, ord)
  LEFT JOIN bingo_session_calls sc
    ON sc.session_id = p.session_id
   AND sc.id = NULLIF(cells.cell->>'call_id', '')::int
) rebuilt;

UPDATE bingo_cards bc
SET grid = rcg.grid_json
FROM repair_card_grids rcg
WHERE bc.id = rcg.card_id;

SELECT
  (SELECT session_id FROM repair_params) AS session_id,
  (SELECT playlist_letter FROM repair_active_choice) AS source_playlist_letter,
  (SELECT round_number FROM repair_active_choice) AS source_round,
  (SELECT COUNT(*) FROM repair_new_calls) AS remapped_call_count,
  (SELECT COUNT(*) FROM bingo_session_calls c JOIN repair_params p ON p.session_id = c.session_id) AS touched_call_count,
  (SELECT COUNT(*) FROM bingo_cards bc JOIN repair_params p ON p.session_id = bc.session_id) AS updated_card_count;

COMMIT;
