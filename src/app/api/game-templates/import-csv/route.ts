import { NextResponse } from "next/server";
import Papa from "papaparse";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import {
  buildInventoryIndex,
  fetchInventoryTracks,
  matchTracks,
  sanitizePlaylistName,
} from "src/lib/vinylPlaylistImport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
  }

  const csvText = await file.text();
  type CsvParseResult = {
    data: Record<string, string>[];
    errors: Array<{ message: string }>;
    meta: { fields?: string[] };
  };

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  }) as CsvParseResult;

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const fields = (parsed.meta.fields ?? []).map((field) => field.toLowerCase());
  const titleIndex = fields.findIndex((field) => field === "title" || field === "song" || field === "track");
  const artistIndex = fields.findIndex((field) => field === "artist" || field === "performer");

  if (titleIndex === -1 || artistIndex === -1) {
    return NextResponse.json({ error: "CSV must include Title and Artist columns." }, { status: 400 });
  }

  const titleField = parsed.meta.fields?.[titleIndex] ?? "Title";
  const artistField = parsed.meta.fields?.[artistIndex] ?? "Artist";

  const rows = parsed.data.map((row) => ({
    title: row[titleField]?.trim(),
    artist: row[artistField]?.trim(),
  }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV contains no rows." }, { status: 400 });
  }

  const inventoryTracks = await fetchInventoryTracks();
  const index = buildInventoryIndex(inventoryTracks);
  const { matched, missing } = matchTracks(rows, index);

  if (matched.length === 0) {
    return NextResponse.json({ error: "No matching vinyl tracks found." }, { status: 400 });
  }

  const playlistName = sanitizePlaylistName(file.name.replace(/\.csv$/i, ""));

  const { data: template, error: templateError } = await supabaseAdmin
    .from("game_templates")
    .insert({
      name: playlistName,
      source: "import_csv",
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
