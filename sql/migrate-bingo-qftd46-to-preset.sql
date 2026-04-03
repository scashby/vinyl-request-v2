BEGIN;

DO $$
DECLARE
  target_session RECORD;
  chosen_preset_id bigint;
  pool_round integer;
  pool_track_count integer;
BEGIN
  SELECT *
  INTO target_session
  FROM public.bingo_sessions
  WHERE session_code = 'QFTD46'
  ORDER BY id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Legacy bingo session QFTD46 was not found';
  END IF;

  SELECT min(round_number)
  INTO pool_round
  FROM public.bingo_session_round_tracks
  WHERE session_id = target_session.id;

  IF pool_round IS NULL THEN
    RAISE EXCEPTION 'Legacy bingo session QFTD46 has no saved round snapshots to migrate';
  END IF;

  SELECT count(*)
  INTO pool_track_count
  FROM public.bingo_session_round_tracks
  WHERE session_id = target_session.id
    AND round_number = pool_round;

  IF pool_track_count < 75 THEN
    RAISE EXCEPTION 'Legacy bingo session QFTD46 only has % saved pool tracks; expected at least 75', pool_track_count;
  END IF;

  chosen_preset_id := target_session.game_preset_id;

  IF chosen_preset_id IS NULL THEN
    SELECT id
    INTO chosen_preset_id
    FROM public.bingo_game_presets
    WHERE created_from_session_id = target_session.id
    ORDER BY id
    LIMIT 1;
  END IF;

  IF chosen_preset_id IS NULL THEN
    INSERT INTO public.bingo_game_presets (
      name,
      source_playlist_ids,
      pool_size,
      created_from_session_id,
      note,
      archived
    )
    VALUES (
      target_session.session_code,
      COALESCE(target_session.master_playlist_ids, target_session.playlist_ids, jsonb_build_array(target_session.playlist_id)),
      pool_track_count,
      target_session.id,
      NULLIF(btrim(target_session.favorite_note), ''),
      false
    )
    RETURNING id
    INTO chosen_preset_id;
  END IF;

  INSERT INTO public.bingo_game_pool_tracks (preset_id, track_key, sort_order)
  SELECT
    chosen_preset_id,
    round_tracks.playlist_track_key,
    round_tracks.slot_index
  FROM public.bingo_session_round_tracks AS round_tracks
  WHERE round_tracks.session_id = target_session.id
    AND round_tracks.round_number = pool_round
    AND NOT EXISTS (
      SELECT 1
      FROM public.bingo_game_pool_tracks AS existing
      WHERE existing.preset_id = chosen_preset_id
        AND existing.track_key = round_tracks.playlist_track_key
    )
  ORDER BY round_tracks.slot_index;

  INSERT INTO public.bingo_preset_crates (
    preset_id,
    crate_letter,
    crate_name,
    call_order,
    created_from_session_id,
    created_for_round,
    created_at
  )
  SELECT
    chosen_preset_id,
    legacy_crates.crate_letter,
    legacy_crates.crate_name,
    legacy_crates.call_order,
    legacy_crates.session_id,
    legacy_crates.round_number,
    legacy_crates.created_at
  FROM public.bingo_session_crates AS legacy_crates
  WHERE legacy_crates.session_id = target_session.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.bingo_preset_crates AS existing
      WHERE existing.preset_id = chosen_preset_id
        AND existing.crate_letter = legacy_crates.crate_letter
    )
  ORDER BY legacy_crates.created_at, legacy_crates.id;

  UPDATE public.bingo_game_presets
  SET pool_size = (
        SELECT count(*)
        FROM public.bingo_game_pool_tracks
        WHERE preset_id = chosen_preset_id
      ),
      updated_at = now()
  WHERE id = chosen_preset_id;

  UPDATE public.bingo_sessions
  SET game_preset_id = chosen_preset_id
  WHERE id = target_session.id;
END $$;

COMMIT;