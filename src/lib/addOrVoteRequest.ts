// src/lib/addOrVoteRequest.ts
// Insert a request for (eventId, albumId|artist+title, side).
// If it already exists, increment votes by 1 and return the updated row.

import { supabase } from "src/lib/supabaseClient";

interface AddOrVoteParams {
  eventId: number | string;
  albumId?: number | string | null;
  inventoryId?: number | string | null;
  recordingId?: number | string | null;
  side?: string; // 'A' | 'B' | ...
  artist: string;
  title: string;
  status?: string;
}

export async function addOrVoteRequest({
  eventId,
  inventoryId = null,
  recordingId = null,
  side,
  artist,
  title,
  status = "pending",
}: AddOrVoteParams) {
  const toNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === "string" ? Number(value) : value;
    return Number.isNaN(parsed) ? null : parsed;
  };

  const eventIdNum = toNumber(eventId);
  const recordingIdNum = toNumber(recordingId);
  if (eventIdNum === null) {
    throw new Error("Invalid event ID");
  }
  const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
    Array.isArray(value) ? value[0] ?? null : value ?? null;
  const normalizeSide = (value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.toLowerCase().startsWith("side ")
      ? trimmed
      : `Side ${trimmed}`;
  };
  let resolvedInventoryId = toNumber(inventoryId);

  if (!resolvedInventoryId) {
    const { data: existingArtist, error: artistError } = await supabase
      .from("artists")
      .select("id")
      .ilike("name", artist)
      .maybeSingle();

    if (artistError) throw artistError;

    let artistId = existingArtist?.id;
    if (!artistId) {
      const { data: createdArtist, error: createArtistError } = await supabase
        .from("artists")
        .insert({ name: artist || "Unknown Artist" })
        .select("id")
        .single();

      if (createArtistError) throw createArtistError;
      artistId = createdArtist.id;
    }

    const { data: createdMaster, error: masterError } = await supabase
      .from("masters")
      .insert({
        title: title || "Placeholder Master",
        main_artist_id: artistId,
      })
      .select("id")
      .single();

    if (masterError || !createdMaster) throw masterError;

    const { data: createdRelease, error: releaseError } = await supabase
      .from("releases")
      .insert({
        master_id: createdMaster.id,
        media_type: "Unknown",
      })
      .select("id")
      .single();

    if (releaseError || !createdRelease) throw releaseError;

    const { data: createdInventory, error: inventoryError } = await supabase
      .from("inventory")
      .insert({
        release_id: createdRelease.id,
        status: "placeholder",
      })
      .select("id")
      .single();

    if (inventoryError || !createdInventory) throw inventoryError;
    resolvedInventoryId = createdInventory.id;
  }

  let requestQuery = supabase
    .from("requests_v3")
    .select("id, votes")
    .eq("event_id", eventIdNum)
    .limit(1);

  if (resolvedInventoryId !== null && resolvedInventoryId !== undefined) {
    requestQuery = requestQuery.eq("inventory_id", resolvedInventoryId);
  } else {
    requestQuery = requestQuery.is("inventory_id", null);
  }

  if (recordingIdNum !== null && recordingIdNum !== undefined) {
    requestQuery = requestQuery.eq("recording_id", recordingIdNum);
  } else {
    requestQuery = requestQuery.is("recording_id", null);
  }

  const { data: requestRows, error: requestFindErr } = await requestQuery;
  if (requestFindErr) throw requestFindErr;
  const existingRequest = requestRows?.[0];

  if (existingRequest) {
    const { data, error } = await supabase
      .from("requests_v3")
      .update({ votes: (existingRequest.votes ?? 0) + 1 })
      .eq("id", existingRequest.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data: inventoryDetails, error: inventoryDetailsError } = await supabase
    .from("inventory")
    .select(
      `id,
       release:releases (
         master:masters (
           title,
           artist:artists (name)
         )
       )`
    )
    .eq("id", resolvedInventoryId)
    .single();

  if (inventoryDetailsError) throw inventoryDetailsError;

  const { data: recordingDetails, error: recordingDetailsError } = recordingIdNum
    ? await supabase
        .from("recordings")
        .select("title")
        .eq("id", recordingIdNum)
        .single()
    : { data: null, error: null };

  if (recordingDetailsError) throw recordingDetailsError;

  const release = toSingle(inventoryDetails?.release);
  const master = toSingle(release?.master);
  const artistName =
    toSingle(master?.artist)?.name || artist || "Unknown Artist";
  const masterTitle =
    master?.title || title || "Untitled";
  const sideLabel = normalizeSide(side);
  const trackTitle = recordingDetails?.title || sideLabel || masterTitle;

  const payload = {
    event_id: eventIdNum,
    inventory_id: resolvedInventoryId,
    recording_id: recordingIdNum,
    artist_name: artistName,
    track_title: trackTitle,
    status,
    votes: 1,
  };

  const { data, error } = await supabase
    .from("requests_v3")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}
