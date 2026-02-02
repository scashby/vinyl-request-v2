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
  if (!inventoryId && !recordingId) {
    throw new Error("inventoryId or recordingId is required for V3 requests.");
  }

  let v3Query = supabase
    .from("requests_v3")
    .select("id, votes")
    .eq("event_id", eventId)
    .limit(1);

  if (inventoryId !== null && inventoryId !== undefined) {
    v3Query = v3Query.eq("inventory_id", inventoryId);
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

  const payload = {
    event_id: eventId,
    inventory_id: inventoryId,
    recording_id: recordingId,
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
