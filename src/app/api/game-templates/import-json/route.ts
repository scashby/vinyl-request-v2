import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import {
  buildInventoryIndex,
  fetchInventoryTracks,
  matchTracks,
  sanitizePlaylistName,
} from "src/lib/vinylPlaylistImport";

export const runtime = "nodejs";

type JsonTrack = {
  title?: string;
  artist?: string;
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "JSON file is required." }, { status: 400 });
  }

  const text = await file.text();
  let parsed: JsonTrack[] = [];

  try {
    const raw = JSON.parse(text);
    if (Array.isArray(raw)) {
      parsed = raw as JsonTrack[];
    } else if (Array.isArray(raw?.tracks)) {
      parsed = raw.tracks as JsonTrack[];
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON format." }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "JSON contains no tracks." }, { status: 400 });
  }

  const rows = parsed.map((item) => ({
    title: item.title?.trim(),
    artist: item.artist?.trim(),
  }));

  const inventoryTracks = await fetchInventoryTracks();
  const index = buildInventoryIndex(inventoryTracks);
  const { matched, missing } = matchTracks(rows, index);

  if (matched.length === 0) {
    return NextResponse.json({ error: "No matching vinyl tracks found." }, { status: 400 });
  }

  const playlistName = sanitizePlaylistName(file.name.replace(/\.json$/i, ""));

  const { data: template, error: templateError } = await supabaseAdmin
    .from("game_templates")
    .insert({
      name: playlistName,
      source: "import_json",
      setlist_mode: false,
    })
    .select("*")
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message ?? "Failed to create playlist." }, { status: 500 });
  }

  const limited = matched.slice(0, 300);
  const { error: itemsError } = await supabaseAdmin
    .from("game_template_items")
    .insert(
      limited.map((item, index) => ({
        template_id: template.id,
        inventory_id: item.inventory_id,
        recording_id: item.recording_id,
        title: item.title,
        artist: item.artist,
        side: item.side,
        position: item.position,
        sort_order: index + 1,
      }))
    );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        template,
        matched: limited.length,
        unmatched: missing.length,
        items: limited.map((item, index) => ({
          id: index + 1,
          title: item.title,
          artist: item.artist,
        })),
      },
    },
    { status: 201 }
  );
}
