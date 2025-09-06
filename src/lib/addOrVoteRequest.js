// src/lib/addOrVoteRequest.js
// Insert a request for (eventId, albumId, side). If it already exists, bump votes by 1.
// For manual requests (no albumId), match by artist+title+side within the same event.

import { supabase } from "src/lib/supabaseClient";

export async function addOrVoteRequest({
  eventId,
  albumId = null,       // number | string | null
  side,                 // 'A' | 'B' | ...
  artist,               // required for first insert or when albumId is null
  title,                // required for first insert or when albumId is null
  status = "open",      // default matches your existing album-detail usage
  folder = "Unknown",
  year = null,
  format = null,
}) {
  // 1) find existing row for this event + side (+ albumId OR artist+title)
  let query = supabase
    .from("requests")
    .select("id, votes")
    .eq("event_id", eventId)
    .eq("side", side)
    .limit(1);

  if (albumId !== null && albumId !== undefined) {
    query = query.eq("album_id", albumId);
  } else {
    query = query
      .is("album_id", null)
      .eq("artist", artist)
      .eq("title", title);
  }

  const { data: existingRows, error: findErr } = await query;
  if (findErr) throw findErr;

  const existing = Array.isArray(existingRows) ? existingRows[0] : null;

  if (existing) {
    // 2) increment votes
    const { data, error } = await supabase
      .from("requests")
      .update({ votes: (existing.votes ?? 0) + 1 })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 3) insert new with votes = 1
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
