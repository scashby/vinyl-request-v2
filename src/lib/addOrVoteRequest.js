// Insert a request for (eventId, albumId, side). If it already exists,
// increment votes by 1 and return the updated row.
// Works even when albumId is null (manual requests) by matching on artist+title+side.
import { supabase } from "src/lib/supabaseClient";

export async function addOrVoteRequest({
  eventId,
  albumId = null,       // number | string | null
  side,                 // 'A' | 'B' | ...
  artist,               // required for first insert (or when albumId is null)
  title,                // required for first insert (or when albumId is null)
  status = "pending",
  folder = "Unknown",
  year = null,
  format = null,
}) {
  // 1) Try to find an existing row for this event/album(or artist+title)/side
  let query = supabase
    .from("requests")
    .select("id, votes")
    .eq("event_id", eventId)
    .eq("side", side)
    .limit(1);

  if (albumId !== null && albumId !== undefined) {
    query = query.eq("album_id", albumId);
  } else {
    // For manual entries (no album_id), match on artist+title
    query = query
      .is("album_id", null)
      .eq("artist", artist)
      .eq("title", title);
  }

  const found = await query;
  if (found.error) throw found.error;
  const existing = Array.isArray(found.data) ? found.data[0] : null;

  if (existing) {
    // 2) Increment votes on the existing row
    const { data, error } = await supabase
      .from("requests")
      .update({ votes: (existing.votes ?? 0) + 1 })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // 3) No match — create a brand new row with votes=1
  const insertPayload = {
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
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}
