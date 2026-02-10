import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

const VINYL_SIZES = ['7"', '10"', '12"'];
const DEFAULT_LIMIT = 300;

const flattenInventoryTracks = (inventoryRows: any[]) => {
  const items: {
    inventory_id: number | null;
    recording_id: number | null;
    title: string;
    artist: string;
    side: string | null;
    position: string | null;
    sort_order: number;
  }[] = [];

  let sortOrder = 1;

  for (const row of inventoryRows) {
    const release = row.releases;
    if (!release || !release.release_tracks) continue;

    for (const track of release.release_tracks) {
      const recording = track.recordings;
      const title = track.title_override || recording?.title;
      const artist = recording?.track_artist || "Unknown Artist";
      if (!title) continue;

      items.push({
        inventory_id: row.id ?? null,
        recording_id: recording?.id ?? null,
        title,
        artist,
        side: track.side ?? null,
        position: track.position ?? null,
        sort_order: sortOrder,
      });
      sortOrder += 1;
    }
  }

  return items;
};

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  const { data: template, error: templateError } = await supabaseAdmin
    .from("game_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 500 });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("game_template_items")
    .select("*")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { template, items } }, { status: 200 });
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  let payload: {
    name?: string;
    setlistMode?: boolean;
    rebuild?: boolean;
    limit?: number;
  } = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.setlistMode !== undefined) updates.setlist_mode = Boolean(payload.setlistMode);

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("game_templates")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (payload.rebuild) {
    const limit = payload.limit && payload.limit > 0 ? payload.limit : DEFAULT_LIMIT;
    const { data: inventoryRows, error: inventoryError } = await supabaseAdmin
      .from("inventory")
      .select(
        "id, releases ( id, media_type, format_details, release_tracks ( id, position, side, title_override, recordings ( id, title, track_artist ) ) )"
      )
      .eq("releases.media_type", "Vinyl")
      .overlaps("releases.format_details", VINYL_SIZES)
      .limit(limit);

    if (inventoryError) {
      return NextResponse.json({ error: inventoryError.message }, { status: 500 });
    }

    const items = flattenInventoryTracks(inventoryRows ?? []);

    if (items.length === 0) {
      return NextResponse.json({ error: "No vinyl tracks found for playlist." }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("game_template_items")
      .delete()
      .eq("template_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: insertError } = await supabaseAdmin
      .from("game_template_items")
      .insert(
        items.map((item) => ({
          template_id: id,
          inventory_id: item.inventory_id,
          recording_id: item.recording_id,
          title: item.title,
          artist: item.artist,
          side: item.side,
          position: item.position,
          sort_order: item.sort_order,
        }))
      );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const id = Number(context.params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid template id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("game_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
