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
  folder?: string;
  year?: number | string | null;
  format?: string | null;
}

export async function addOrVoteRequest({
  eventId,
  albumId = null,
  inventoryId = null,
  recordingId = null,
  side,
  artist,
  title,
  status = "open",
  folder = "Unknown",
  year = null,
  format = null,
}: AddOrVoteParams) {
  const shouldUseV3 = recordingId !== null || (inventoryId !== null && !side);

  if (shouldUseV3) {
    try {
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
    } catch (error) {
      console.warn("Falling back to requests table:", error);
    }
  }

  // 1) Look for an existing row in this event for this side
  if (!side) {
    throw new Error("Side is required for legacy requests.");
  }

  let query = supabase
    .from("requests")
    .select("id, votes")
    .eq("event_id", eventId)
    .eq("side", side)
    .limit(1);

  if (albumId !== null && albumId !== undefined) {
    query = query.eq("album_id", albumId);
  } else {
    // manual requests: match by artist+title with null album_id
    query = query.is("album_id", null).eq("artist", artist).eq("title", title);
  }

  const { data: rows, error: findErr } = await query;
  if (findErr) throw findErr;
  const existing = rows?.[0];

  if (existing) {
    // 2) Increment votes
    const { data, error } = await supabase
      .from("requests")
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
    album_id: albumId,
    side,
    artist,
    title,
    status,
    votes: 1,
    folder,
    year,
    format,
  };

  const { data, error } = await supabase
    .from("requests")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}
