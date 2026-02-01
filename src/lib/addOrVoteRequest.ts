// src/lib/addOrVoteRequest.ts
// Insert a request for (eventId, albumId|artist+title, side).
// If it already exists, increment votes by 1 and return the updated row.

import { supabase } from "src/lib/supabaseClient";

interface AddOrVoteParams {
  eventId: number | string;
  inventoryId?: number | string | null;
  side: string; // 'A' | 'B' | ...
  artist: string;
  title: string;
  status?: string;
}

export async function addOrVoteRequest({
  eventId,
  inventoryId = null,
  side,
  artist,
  title,
  status = "pending",
}: AddOrVoteParams) {
  const trackTitle = `${title} (Side ${side})`;
  // 1) Look for an existing row in this event for this side
  let query = supabase
    .from("requests_v3")
    .select("id, votes")
    .eq("event_id", eventId)
    .limit(1);

  if (inventoryId !== null && inventoryId !== undefined) {
    query = query.eq("inventory_id", inventoryId).eq("track_title", trackTitle);
  } else {
    // manual requests: match by artist+title with null inventory_id
    query = query
      .is("inventory_id", null)
      .eq("artist_name", artist)
      .eq("track_title", trackTitle);
  }

  const { data: rows, error: findErr } = await query;
  if (findErr) throw findErr;
  const existing = rows?.[0];

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
    recording_id: null,
    artist_name: artist,
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
