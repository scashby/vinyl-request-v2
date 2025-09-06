// src/lib/addOrVoteRequest.js
// Insert a request for (eventId, albumId|artist+title, side).
// If it already exists, increment votes by 1 and return the updated row.

import { supabase } from "src/lib/supabaseClient";

export async function addOrVoteRequest({
  eventId,
  albumId = null,
  side,                 // 'A' | 'B' | ...
  artist,
  title,
  status = "open",
  folder = "Unknown",
  year = null,
  format = null,
}) {
  // 1) Look for an existing row in this event for this side
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
