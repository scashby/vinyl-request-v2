// src/lib/addOrVoteRequest.ts
// Insert a request for (eventId, inventoryId, recordingId).
// If it already exists, increment votes by 1 and return the updated row.

import { supabase } from "src/lib/supabaseClient";

interface AddOrVoteParams {
  eventId: number | string;
  inventoryId?: number | string | null;
  recordingId?: number | string | null;
  artistName: string;
  trackTitle?: string | null;
  status?: string;
}

export async function addOrVoteRequest({
  eventId,
  inventoryId = null,
  recordingId = null,
  artistName,
  trackTitle = null,
  status = "pending",
}: AddOrVoteParams) {
  // 1) Look for an existing row in this event for this inventory/recording
  let query = supabase
    .from("requests_v3")
    .select("id, votes")
    .eq("event_id", eventId)
    .limit(1);

  if (inventoryId !== null && inventoryId !== undefined) {
    query = query.eq("inventory_id", inventoryId);
  } else {
    query = query.is("inventory_id", null);
  }

  if (recordingId !== null && recordingId !== undefined) {
    query = query.eq("recording_id", recordingId);
  } else {
    query = query.is("recording_id", null);
  }

  if (recordingId == null) {
    if (trackTitle) {
      query = query.eq("track_title", trackTitle);
    } else {
      query = query.is("track_title", null);
    }
    if (artistName) {
      query = query.eq("artist_name", artistName);
    }
  }

  const { data: rows, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;
  const existing = rows;

  if (existing) {
    // 2) Increment votes
    const { data, error } = await supabase
      .from("requests_v3")
      .update({ votes: (existing.votes ?? 0) + 1 })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 3) Insert new with votes=1
  const payload = {
    event_id: eventId,
    inventory_id: inventoryId,
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
