import { NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

type ParsedTrackKey = {
  trackKey: string;
  inventoryId: number | null;
  releaseTrackId: number | null;
  recordingId: number | null;
  fallbackPosition: string | null;
};

const parseTrackKey = (trackKey: string): ParsedTrackKey => {
  const [inventoryPart, releaseTrackPart, recordingPart] = String(trackKey).split(":");
  const inventoryId = Number.parseInt(inventoryPart ?? "", 10);
  const releaseTrackId = /^\d+$/.test(releaseTrackPart ?? "") ? Number.parseInt(releaseTrackPart, 10) : null;
  const recordingId = /^\d+$/.test(recordingPart ?? "") ? Number.parseInt(recordingPart, 10) : null;
  const fallbackPosition = (releaseTrackPart ?? "").startsWith("p:") ? releaseTrackPart.slice(2) : null;

  return {
    trackKey,
    inventoryId: Number.isFinite(inventoryId) ? inventoryId : null,
    releaseTrackId,
    recordingId,
    fallbackPosition: fallbackPosition || null,
  };
};

async function ensureVbTemplatesFromCollection(db: any): Promise<void> {
  const { data: existingTemplates, error: existingError } = await db
    .from("vb_templates")
    .select("id")
    .limit(1);

  if (existingError || (existingTemplates ?? []).length > 0) return;

  const { data: playlists, error: playlistError } = await db
    .from("collection_playlists")
    .select("id, name, sort_order, created_at")
    .order("sort_order", { ascending: true });

  if (playlistError || (playlists ?? []).length === 0) return;

  const { data: playlistItems, error: itemError } = await db
    .from("collection_playlist_items")
    .select("playlist_id, track_key, sort_order")
    .order("sort_order", { ascending: true });

  if (itemError) return;

  const itemsByPlaylist = new Map<number, Array<{ track_key: string; sort_order: number | null }>>();
  for (const row of playlistItems ?? []) {
    const playlistId = Number(row.playlist_id);
    if (!Number.isFinite(playlistId) || !row.track_key) continue;
    if (!itemsByPlaylist.has(playlistId)) itemsByPlaylist.set(playlistId, []);
    itemsByPlaylist.get(playlistId)!.push({ track_key: row.track_key, sort_order: row.sort_order ?? 0 });
  }

  for (const playlist of playlists ?? []) {
    const tracks = itemsByPlaylist.get(playlist.id) ?? [];
    if (tracks.length === 0) continue;

    const { data: insertedTemplate, error: templateError } = await db
      .from("vb_templates")
      .insert({
        name: playlist.name,
        description: "Imported from collection playlist",
        source: "vinyl_collection",
        setlist_mode: false,
        created_at: playlist.created_at ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (templateError || !insertedTemplate?.id) continue;

    const parsed = tracks
      .map((item) => ({ ...item, parsed: parseTrackKey(item.track_key) }))
      .filter((item) => item.parsed.inventoryId !== null);

    const inventoryIds = Array.from(new Set(parsed.map((item) => item.parsed.inventoryId).filter((v): v is number => v !== null)));
    const releaseTrackIds = Array.from(new Set(parsed.map((item) => item.parsed.releaseTrackId).filter((v): v is number => v !== null)));
    const recordingIds = Array.from(new Set(parsed.map((item) => item.parsed.recordingId).filter((v): v is number => v !== null)));

    const [{ data: inventoryRows }, { data: releaseTrackRows }, { data: recordingRows }] = await Promise.all([
      inventoryIds.length
        ? db.from("inventory").select("id, release_id").in("id", inventoryIds)
        : Promise.resolve({ data: [] }),
      releaseTrackIds.length
        ? db.from("release_tracks").select("id, recording_id, position, side, title_override").in("id", releaseTrackIds)
        : Promise.resolve({ data: [] }),
      recordingIds.length
        ? db.from("recordings").select("id, title, track_artist").in("id", recordingIds)
        : Promise.resolve({ data: [] }),
    ]);

    const inventoryById = new Map<number, any>((inventoryRows ?? []).map((row: any) => [row.id, row]));
    const releaseTrackById = new Map<number, any>((releaseTrackRows ?? []).map((row: any) => [row.id, row]));

    const inferredRecordingIds = Array.from(
      new Set(
        (releaseTrackRows ?? [])
          .map((row: any) => row.recording_id)
          .filter((v: unknown): v is number => typeof v === "number")
      )
    );

    const missingRecordingIds = inferredRecordingIds.filter((id) => !recordingIds.includes(id));
    let inferredRecordingRows: any[] = [];
    if (missingRecordingIds.length > 0) {
      const { data } = await db.from("recordings").select("id, title, track_artist").in("id", missingRecordingIds);
      inferredRecordingRows = data ?? [];
    }

    const recordingById = new Map<number, any>(
      [...(recordingRows ?? []), ...inferredRecordingRows].map((row: any) => [row.id, row])
    );

    const releaseIds = Array.from(
      new Set(
        (inventoryRows ?? [])
          .map((row: any) => row.release_id)
          .filter((v: unknown): v is number => typeof v === "number")
      )
    );
    const { data: releaseRows } = releaseIds.length
      ? await db.from("releases").select("id, master_id").in("id", releaseIds)
      : { data: [] };
    const releaseById = new Map<number, any>((releaseRows ?? []).map((row: any) => [row.id, row]));

    const masterIds = Array.from(
      new Set(
        (releaseRows ?? [])
          .map((row: any) => row.master_id)
          .filter((v: unknown): v is number => typeof v === "number")
      )
    );
    const { data: masterRows } = masterIds.length
      ? await db.from("masters").select("id, title, main_artist_id").in("id", masterIds)
      : { data: [] };
    const masterById = new Map<number, any>((masterRows ?? []).map((row: any) => [row.id, row]));

    const artistIds = Array.from(
      new Set(
        (masterRows ?? [])
          .map((row: any) => row.main_artist_id)
          .filter((v: unknown): v is number => typeof v === "number")
      )
    );
    const { data: artistRows } = artistIds.length
      ? await db.from("artists").select("id, name").in("id", artistIds)
      : { data: [] };
    const artistById = new Map<number, any>((artistRows ?? []).map((row: any) => [row.id, row]));

    const vbTracks = parsed.map((item, index) => {
      const key = item.parsed;
      const inventory = key.inventoryId ? inventoryById.get(key.inventoryId) : null;
      const release = inventory?.release_id ? releaseById.get(inventory.release_id) : null;
      const master = release?.master_id ? masterById.get(release.master_id) : null;
      const releaseTrack = key.releaseTrackId ? releaseTrackById.get(key.releaseTrackId) : null;
      const recording = recordingById.get(key.recordingId ?? releaseTrack?.recording_id ?? -1);

      return {
        template_id: insertedTemplate.id,
        inventory_id: key.inventoryId,
        recording_id: recording?.id ?? null,
        track_title: releaseTrack?.title_override ?? recording?.title ?? `Track ${index + 1}`,
        artist_name: recording?.track_artist ?? artistById.get(master?.main_artist_id)?.name ?? "Unknown Artist",
        album_name: master?.title ?? null,
        side: releaseTrack?.side ?? null,
        position: releaseTrack?.position ?? key.fallbackPosition ?? null,
        sort_order: item.sort_order ?? index,
      };
    });

    if (vbTracks.length > 0) {
      await db.from("vb_template_tracks").insert(vbTracks);
    }
  }
}

export async function GET() {
  const db = supabaseAdmin as any;
  await ensureVbTemplatesFromCollection(db);

  const { data, error } = await db
    .from("vb_templates")
    .select("id, name, description, source, setlist_mode, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await Promise.all(
    (data ?? []).map(async (template: any) => {
      const { count } = await db
        .from("vb_template_tracks")
        .select("id", { count: "exact", head: true })
        .eq("template_id", template.id);

      return { ...template, track_count: count ?? 0 };
    })
  );

  return NextResponse.json({ data: rows }, { status: 200 });
}
