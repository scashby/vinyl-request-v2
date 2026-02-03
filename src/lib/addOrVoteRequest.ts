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
  albumId = null,
  inventoryId = null,
  recordingId = null,
  side,
  artist,
  title,
  status = "pending",
}: AddOrVoteParams) {
  let resolvedInventoryId = inventoryId;

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

  let v3Query = supabase
    .from("requests_v3")
    .select("id, votes")
    .eq("event_id", eventId)
    .limit(1);

  if (resolvedInventoryId !== null && resolvedInventoryId !== undefined) {
    v3Query = v3Query.eq("inventory_id", resolvedInventoryId);
  } else {
    v3Query = v3Query.is("inventory_id", null);
  }

  if (recordingId !== null && recordingId !== undefined) {
    v3Query = v3Query.eq("recording_id", recordingId);
  } else {
    v3Query = v3Query.is("recording_id", null);
  }

  const { data: v3Rows, error: v3FindErr } = await v3Query;
  if (v3FindErr) throw v3FindErr;
  const existingV3 = v3Rows?.[0];

  if (existingV3) {
    const { data, error } = await supabase
      .from("requests_v3")
      .update({ votes: (existingV3.votes ?? 0) + 1 })
      .eq("id", existingV3.id)
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

  const { data: recordingDetails, error: recordingDetailsError } = recordingId
    ? await supabase
        .from("recordings")
        .select("title")
        .eq("id", recordingId)
        .single()
    : { data: null, error: null };

  if (recordingDetailsError) throw recordingDetailsError;

  const artistName =
    inventoryDetails?.release?.master?.artist?.name || artist || "Unknown Artist";
  const masterTitle =
    inventoryDetails?.release?.master?.title || title || "Untitled";
  const trackTitle = recordingDetails?.title || masterTitle;

  const payload = {
    event_id: eventId,
    inventory_id: resolvedInventoryId,
    recording_id: recordingId,
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
