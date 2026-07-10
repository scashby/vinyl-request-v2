BEGIN;

-- Track swap utility for a single Bingo session.
--
-- What this does:
-- 1) Replaces one track key with another across the session's source playlists
--    (master + sub + round playlists), plus matching Bingo mirror playlists.
-- 2) Updates Bingo session data (round tracks, calls, cards, game playlist call_order).
-- 3) Updates Bingo game crate mirror rows (crate_items.track_key) for the session.
--
-- How to use:
-- - Edit only the VALUES row in _swap_params.
-- - Run in Supabase SQL editor.
-- - Review output counts at the end.

CREATE TEMP TABLE _swap_params (
  session_id bigint NOT NULL,
  from_artist text NOT NULL,
  from_title text NOT NULL,
  to_artist text NOT NULL,
  to_title text NOT NULL
) ON COMMIT DROP;

-- TODO: edit these values for each swap request.
INSERT INTO _swap_params (session_id, from_artist, from_title, to_artist, to_title)
VALUES (
  0,
  'Cutting Crew',
  '(I just) Died In your Arms',
  'Devo',
  'Whip It'
);

CREATE TEMP TABLE _swap_norm AS
SELECT
  p.session_id,
  p.from_artist,
  p.from_title,
  p.to_artist,
  p.to_title,
  regexp_replace(lower(p.from_artist), '[^a-z0-9]+', '', 'g') AS from_artist_norm,
  regexp_replace(lower(p.from_title),  '[^a-z0-9]+', '', 'g') AS from_title_norm,
  regexp_replace(lower(p.to_artist),   '[^a-z0-9]+', '', 'g') AS to_artist_norm,
  regexp_replace(lower(p.to_title),    '[^a-z0-9]+', '', 'g') AS to_title_norm
FROM _swap_params p;

CREATE TEMP TABLE _swap_session AS
SELECT s.id, s.session_code, s.playlist_id, s.playlist_ids, s.master_playlist_ids, s.round_playlist_ids
FROM public.bingo_sessions s
JOIN _swap_norm p ON p.session_id = s.id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _swap_session) THEN
    RAISE EXCEPTION 'Session % not found in bingo_sessions.', (SELECT session_id FROM _swap_params LIMIT 1);
  END IF;
END $$;

CREATE TEMP TABLE _swap_session_playlists AS
WITH base AS (
  SELECT ss.playlist_id AS playlist_id
  FROM _swap_session ss
  WHERE ss.playlist_id IS NOT NULL

  UNION ALL

  SELECT unnest(ss.playlist_ids)::bigint
  FROM _swap_session ss
  WHERE ss.playlist_ids IS NOT NULL

  UNION ALL

  SELECT unnest(ss.master_playlist_ids)::bigint
  FROM _swap_session ss
  WHERE ss.master_playlist_ids IS NOT NULL

  UNION ALL

  SELECT (jsonb_array_elements(entry.value -> 'playlist_ids'))::text::bigint
  FROM _swap_session ss
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ss.round_playlist_ids, '[]'::jsonb)) entry(value)
)
SELECT DISTINCT playlist_id
FROM base
WHERE playlist_id IS NOT NULL AND playlist_id > 0;

CREATE TEMP TABLE _swap_old_key AS
WITH ranked AS (
  SELECT
    c.playlist_track_key AS track_key,
    count(*) AS hit_count
  FROM public.bingo_session_calls c
  JOIN _swap_norm p ON p.session_id = c.session_id
  WHERE c.playlist_track_key IS NOT NULL
    AND regexp_replace(lower(COALESCE(c.artist_name, '')), '[^a-z0-9]+', '', 'g') = p.from_artist_norm
    AND regexp_replace(lower(COALESCE(c.track_title, '')),  '[^a-z0-9]+', '', 'g') = p.from_title_norm
  GROUP BY c.playlist_track_key
)
SELECT track_key
FROM ranked
ORDER BY hit_count DESC, track_key
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _swap_old_key) THEN
    RAISE EXCEPTION 'No source track key found in bingo_session_calls for session %, artist/title = % / %.',
      (SELECT session_id FROM _swap_params LIMIT 1),
      (SELECT from_artist FROM _swap_params LIMIT 1),
      (SELECT from_title FROM _swap_params LIMIT 1);
  END IF;
END $$;

CREATE TEMP TABLE _swap_new_candidate AS
WITH candidates AS (
  SELECT
    inv.id AS inventory_id,
    rt.id AS release_track_id,
    rec.id AS recording_id,
    COALESCE(NULLIF(rt.title_override, ''), NULLIF(rec.title, ''), '') AS track_title,
    COALESCE(
      NULLIF(regexp_replace(COALESCE(rec.track_artist, ''), '\\s+\\(\\d+\\)\\s*$', ''), ''),
      NULLIF(regexp_replace(COALESCE(art.name, ''), '\\s+\\(\\d+\\)\\s*$', ''), '')
    ) AS artist_name,
    m.title AS album_name,
    rt.side,
    rt.position,
    (inv.id::text || ':' || rt.id::text || ':' || rec.id::text) AS track_key,
    EXISTS (
      SELECT 1
      FROM public.collection_playlist_items i
      JOIN _swap_session_playlists sp ON sp.playlist_id = i.playlist_id
      WHERE i.track_key = (inv.id::text || ':' || rt.id::text || ':' || rec.id::text)
      LIMIT 1
    ) AS in_session_playlists
  FROM public.recordings rec
  JOIN public.release_tracks rt ON rt.recording_id = rec.id
  JOIN public.inventory inv ON inv.release_id = rt.release_id
  LEFT JOIN public.releases rel ON rel.id = inv.release_id
  LEFT JOIN public.masters m ON m.id = rel.master_id
  LEFT JOIN public.artists art ON art.id = m.main_artist_id
  JOIN _swap_norm p ON TRUE
  WHERE regexp_replace(lower(COALESCE(rec.title, '')), '[^a-z0-9]+', '', 'g') = p.to_title_norm
    AND (
      regexp_replace(lower(COALESCE(rec.track_artist, '')), '[^a-z0-9]+', '', 'g') = p.to_artist_norm
      OR regexp_replace(lower(COALESCE(art.name, '')), '[^a-z0-9]+', '', 'g') = p.to_artist_norm
    )
)
SELECT *
FROM candidates
ORDER BY in_session_playlists DESC, inventory_id ASC, release_track_id ASC
LIMIT 1;

DO $$
DECLARE
  old_key text;
  new_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _swap_new_candidate) THEN
    RAISE EXCEPTION 'No destination track candidate found for artist/title = % / %.',
      (SELECT to_artist FROM _swap_params LIMIT 1),
      (SELECT to_title FROM _swap_params LIMIT 1);
  END IF;

  SELECT track_key INTO old_key FROM _swap_old_key LIMIT 1;
  SELECT track_key INTO new_key FROM _swap_new_candidate LIMIT 1;

  IF old_key = new_key THEN
    RAISE EXCEPTION 'Source and destination resolve to the same track_key (%).', old_key;
  END IF;
END $$;

CREATE TEMP TABLE _swap_resolved AS
SELECT
  (SELECT track_key FROM _swap_old_key LIMIT 1) AS old_track_key,
  nc.track_key AS new_track_key,
  nc.track_title AS new_track_title,
  nc.artist_name AS new_artist_name,
  nc.album_name AS new_album_name,
  nc.side AS new_side,
  nc.position AS new_position
FROM _swap_new_candidate nc;

-- Guard against unique conflicts before mutating data.
DO $$
DECLARE
  playlist_conflicts integer;
  round_conflicts integer;
BEGIN
  SELECT count(*) INTO playlist_conflicts
  FROM (
    SELECT i.playlist_id
    FROM public.collection_playlist_items i
    JOIN _swap_session_playlists sp ON sp.playlist_id = i.playlist_id
    CROSS JOIN _swap_resolved r
    WHERE i.track_key IN (r.old_track_key, r.new_track_key)
    GROUP BY i.playlist_id
    HAVING count(*) FILTER (WHERE i.track_key = r.old_track_key) > 0
       AND count(*) FILTER (WHERE i.track_key = r.new_track_key) > 0
  ) t;

  IF playlist_conflicts > 0 THEN
    RAISE EXCEPTION 'Aborting: % playlist(s) already contain both old and new track keys.', playlist_conflicts;
  END IF;

  SELECT count(*) INTO round_conflicts
  FROM (
    SELECT rt.round_number
    FROM public.bingo_session_round_tracks rt
    JOIN _swap_norm p ON p.session_id = rt.session_id
    CROSS JOIN _swap_resolved r
    WHERE rt.playlist_track_key IN (r.old_track_key, r.new_track_key)
    GROUP BY rt.round_number
    HAVING count(*) FILTER (WHERE rt.playlist_track_key = r.old_track_key) > 0
       AND count(*) FILTER (WHERE rt.playlist_track_key = r.new_track_key) > 0
  ) t;

  IF round_conflicts > 0 THEN
    RAISE EXCEPTION 'Aborting: % round(s) already contain both old and new track keys (unique constraint risk).', round_conflicts;
  END IF;
END $$;

-- Keep before/after snapshots for card grid relabeling.
CREATE TEMP TABLE _swap_calls_to_patch AS
SELECT
  c.id AS call_id,
  c.track_title AS old_track_title,
  c.artist_name AS old_artist_name,
  r.new_track_title,
  r.new_artist_name
FROM public.bingo_session_calls c
JOIN _swap_norm p ON p.session_id = c.session_id
CROSS JOIN _swap_resolved r
WHERE c.playlist_track_key = r.old_track_key;

-- 1) Source playlists used by this session (master/sub/round) + Bingo mirror playlists by session code.
CREATE TEMP TABLE _swap_mirror_playlists AS
SELECT cp.id AS playlist_id
FROM public.collection_playlists cp
JOIN _swap_session ss ON TRUE
WHERE cp.name ILIKE ('Bingo ' || ss.session_code || ' Playlist %')
   OR cp.name ILIKE ('Bingo · ' || ss.session_code || ' Playlist %');

WITH updated AS (
  UPDATE public.collection_playlist_items i
  SET track_key = r.new_track_key
  FROM _swap_resolved r
  WHERE i.track_key = r.old_track_key
    AND i.playlist_id IN (
      SELECT playlist_id FROM _swap_session_playlists
      UNION
      SELECT playlist_id FROM _swap_mirror_playlists
    )
  RETURNING 1
)
SELECT count(*) AS updated_collection_playlist_items
FROM updated;

-- 2) Round track snapshots.
WITH updated AS (
  UPDATE public.bingo_session_round_tracks rt
  SET
    playlist_track_key = r.new_track_key,
    track_title = COALESCE(r.new_track_title, rt.track_title),
    artist_name = COALESCE(r.new_artist_name, rt.artist_name),
    album_name = r.new_album_name,
    side = r.new_side,
    position = r.new_position
  FROM _swap_norm p
  CROSS JOIN _swap_resolved r
  WHERE rt.session_id = p.session_id
    AND rt.playlist_track_key = r.old_track_key
  RETURNING 1
)
SELECT count(*) AS updated_bingo_session_round_tracks
FROM updated;

-- 3) Calls.
WITH updated AS (
  UPDATE public.bingo_session_calls c
  SET
    playlist_track_key = r.new_track_key,
    track_title = COALESCE(r.new_track_title, c.track_title),
    artist_name = COALESCE(r.new_artist_name, c.artist_name),
    album_name = r.new_album_name,
    side = r.new_side,
    position = r.new_position,
    metadata_synced_at = now()
  FROM _swap_norm p
  CROSS JOIN _swap_resolved r
  WHERE c.session_id = p.session_id
    AND c.playlist_track_key = r.old_track_key
  RETURNING 1
)
SELECT count(*) AS updated_bingo_session_calls
FROM updated;

-- 4) Stored game playlist call_order JSON.
WITH updated AS (
  UPDATE public.bingo_session_game_playlists gp
  SET call_order = patched.new_call_order
  FROM _swap_norm p
  CROSS JOIN _swap_resolved r
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(
      CASE
        WHEN COALESCE(elem.value ->> 'playlist_track_key', elem.value ->> 'track_key') = r.old_track_key THEN
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(elem.value, '{playlist_track_key}', to_jsonb(r.new_track_key), true),
                  '{track_key}', to_jsonb(r.new_track_key), true
                ),
                '{track_title}', to_jsonb(COALESCE(r.new_track_title, elem.value ->> 'track_title')), true
              ),
              '{artist_name}', to_jsonb(COALESCE(r.new_artist_name, elem.value ->> 'artist_name')), true
            ),
            '{album_name}', to_jsonb(r.new_album_name), true
          )
        ELSE elem.value
      END
      ORDER BY elem.ordinality
    ) AS new_call_order
    FROM jsonb_array_elements(COALESCE(gp.call_order, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
  ) patched
  WHERE gp.session_id = p.session_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(gp.call_order, '[]'::jsonb)) e(value)
      WHERE COALESCE(e.value ->> 'playlist_track_key', e.value ->> 'track_key') = r.old_track_key
    )
  RETURNING 1
)
SELECT count(*) AS updated_bingo_session_game_playlists
FROM updated;

-- 5) Legacy crates table call_order JSON (if present).
DO $$
DECLARE
  v_session_id bigint;
  v_old_key text;
  v_new_key text;
  v_new_title text;
  v_new_artist text;
  v_new_album text;
  v_updated integer := 0;
BEGIN
  IF to_regclass('public.bingo_session_crates') IS NULL THEN
    RAISE NOTICE 'Skipping legacy bingo_session_crates update: table not present.';
    RETURN;
  END IF;

  SELECT session_id INTO v_session_id FROM _swap_norm LIMIT 1;
  SELECT old_track_key, new_track_key, new_track_title, new_artist_name, new_album_name
  INTO v_old_key, v_new_key, v_new_title, v_new_artist, v_new_album
  FROM _swap_resolved
  LIMIT 1;

  EXECUTE format($sql$
    WITH updated AS (
      UPDATE public.bingo_session_crates gp
      SET call_order = patched.new_call_order
      FROM LATERAL (
        SELECT jsonb_agg(
          CASE
            WHEN COALESCE(elem.value ->> 'playlist_track_key', elem.value ->> 'track_key') = %L THEN
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(elem.value, '{playlist_track_key}', to_jsonb(%L), true),
                      '{track_key}', to_jsonb(%L), true
                    ),
                    '{track_title}', to_jsonb(COALESCE(%L, elem.value ->> 'track_title')), true
                  ),
                  '{artist_name}', to_jsonb(COALESCE(%L, elem.value ->> 'artist_name')), true
                ),
                '{album_name}', to_jsonb(%L), true
              )
            ELSE elem.value
          END
          ORDER BY elem.ordinality
        ) AS new_call_order
        FROM jsonb_array_elements(COALESCE(gp.call_order, '[]'::jsonb)) WITH ORDINALITY AS elem(value, ordinality)
      ) patched
      WHERE gp.session_id = %s
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(gp.call_order, '[]'::jsonb)) e(value)
          WHERE COALESCE(e.value ->> 'playlist_track_key', e.value ->> 'track_key') = %L
        )
      RETURNING 1
    )
    SELECT count(*) FROM updated
  $sql$, v_old_key, v_new_key, v_new_key, v_new_title, v_new_artist, v_new_album, v_session_id, v_old_key)
  INTO v_updated;

  RAISE NOTICE 'updated_bingo_session_crates = %', COALESCE(v_updated, 0);
END $$;

-- 6) Cards: patch embedded grid labels and artist/title for affected call_ids.
WITH updated AS (
  UPDATE public.bingo_cards bc
  SET grid = patched.new_grid
  FROM (
    SELECT
      bc_inner.id,
      jsonb_agg(
        CASE
          WHEN cc.call_id IS NULL THEN cell.value
          ELSE
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  cell.value,
                  '{track_title}',
                  to_jsonb(COALESCE(cc.new_track_title, cell.value ->> 'track_title')),
                  true
                ),
                '{artist_name}',
                to_jsonb(COALESCE(cc.new_artist_name, cell.value ->> 'artist_name')),
                true
              ),
              '{label}',
              to_jsonb(
                CASE
                  WHEN (cell.value ->> 'label') = COALESCE(cc.old_track_title, '')
                    THEN COALESCE(cc.new_track_title, cell.value ->> 'label')
                  WHEN (cell.value ->> 'label') = (COALESCE(cc.old_track_title, '') || ' - ' || COALESCE(cc.old_artist_name, ''))
                    THEN COALESCE(cc.new_track_title, cell.value ->> 'track_title') || ' - ' || COALESCE(cc.new_artist_name, cell.value ->> 'artist_name')
                  ELSE cell.value ->> 'label'
                END
              ),
              true
            )
        END
        ORDER BY cell.ordinality
      ) AS new_grid
    FROM public.bingo_cards bc_inner
    JOIN _swap_norm p ON p.session_id = bc_inner.session_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(bc_inner.grid, '[]'::jsonb)) WITH ORDINALITY AS cell(value, ordinality)
    LEFT JOIN _swap_calls_to_patch cc
      ON (cell.value ->> 'call_id') ~ '^[0-9]+$'
     AND (cell.value ->> 'call_id')::bigint = cc.call_id
    GROUP BY bc_inner.id
  ) patched
  WHERE bc.id = patched.id
    AND bc.session_id = (SELECT session_id FROM _swap_norm LIMIT 1)
  RETURNING 1
)
SELECT count(*) AS updated_bingo_cards
FROM updated;

-- 7) Crate pull mirror items for this session code.
WITH target_crates AS (
  SELECT c.id
  FROM public.crates c
  JOIN _swap_session ss ON TRUE
  WHERE c.game_source = 'bingo'
    AND (
      c.name ILIKE ('Bingo ' || ss.session_code || '%')
      OR c.name ILIKE ('Bingo · ' || ss.session_code || '%')
    )
), updated AS (
  UPDATE public.crate_items ci
  SET track_key = r.new_track_key
  FROM _swap_resolved r
  JOIN target_crates tc ON tc.id = ci.crate_id
  WHERE ci.track_key = r.old_track_key
  RETURNING 1
)
SELECT count(*) AS updated_crate_items
FROM updated;

-- Summary row.
SELECT
  (SELECT session_id FROM _swap_norm LIMIT 1) AS session_id,
  (SELECT session_code FROM _swap_session LIMIT 1) AS session_code,
  (SELECT old_track_key FROM _swap_resolved LIMIT 1) AS old_track_key,
  (SELECT new_track_key FROM _swap_resolved LIMIT 1) AS new_track_key,
  (SELECT new_track_title FROM _swap_resolved LIMIT 1) AS new_track_title,
  (SELECT new_artist_name FROM _swap_resolved LIMIT 1) AS new_artist_name;

COMMIT;
