// @ts-nocheck — release_tracks / releases / inventory / masters not in TriviaDatabase; use supabaseAdmin
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { isForSaleInventory } from "src/lib/saleUtils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const db = supabaseAdmin as unknown as { from: (t: string) => unknown };

  // Search release_tracks by title_override and by recordings.title via join.
  const [{ data: byTitle, error: err1 }, { data: byRecording, error: err2 }] = await Promise.all([
    db
      .from("release_tracks")
      .select("id, release_id, recording_id, position, side, title_override")
      .ilike("title_override", `%${q}%`)
      .limit(200) as unknown as Promise<{
        data: Array<{ id: number; release_id: number; recording_id: number | null; position: string | null; side: string | null; title_override: string | null }> | null;
        error: { message: string } | null;
      }>,
    db
      .from("release_tracks")
      .select("id, release_id, recording_id, position, side, title_override, recordings(id, title, track_artist)")
      .ilike("recordings.title", `%${q}%`)
      .not("recording_id", "is", null)
      .limit(200) as unknown as Promise<{
        data: Array<{ id: number; release_id: number; recording_id: number | null; position: string | null; side: string | null; title_override: string | null; recordings: { id: number; title: string; track_artist: string | null } | null }> | null;
        error: { message: string } | null;
      }>,
  ]);

  if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });
  if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });

  // Merge, deduplicate by release_track id
  const seenIds = new Set<number>();
  const allTracks: Array<{
    id: number; release_id: number; recording_id: number | null;
    position: string | null; side: string | null; title_override: string | null;
    recording_title?: string; track_artist?: string | null;
  }> = [];

  for (const rt of [...(byTitle ?? []), ...(byRecording ?? [])]) {
    if (!seenIds.has(rt.id)) {
      seenIds.add(rt.id);
      const rec = (rt as { recordings?: { title: string; track_artist: string | null } | null }).recordings;
      allTracks.push({ ...rt, recording_title: rec?.title, track_artist: rec?.track_artist ?? null });
    }
  }

  if (!allTracks.length) return NextResponse.json({ data: [] });

  const releaseIds = [...new Set(allTracks.map((rt) => rt.release_id))];

  // Fetch inventory and release→master mapping in parallel
  const [{ data: inventory, error: invErr }, { data: releases, error: relErr }] = await Promise.all([
    db
      .from("inventory")
      .select("id, release_id, status, discogs_folder_name, discogs_folder_id, discogs_instance_id")
      .in("release_id", releaseIds)
      .limit(600) as unknown as Promise<{
        data: Array<{ id: number; release_id: number; status: string | null; discogs_folder_name: string | null; discogs_folder_id: number | null; discogs_instance_id: number | null }> | null;
        error: { message: string } | null;
      }>,
    db
      .from("releases")
      .select("id, master_id, format_details")
      .in("id", releaseIds)
      .limit(200) as unknown as Promise<{
        data: Array<{ id: number; master_id: number | null; format_details: string[] | null }> | null;
        error: { message: string } | null;
      }>,
  ]);

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

  // Exclude for-sale inventory
  const ownedInventory = (inventory ?? []).filter((inv) => !isForSaleInventory(inv));
  const inventoryByRelease = new Map<number, number>();
  for (const inv of ownedInventory) {
    if (!inventoryByRelease.has(inv.release_id)) {
      inventoryByRelease.set(inv.release_id, inv.id);
    }
  }
  const ownedReleaseIds = new Set(inventoryByRelease.keys());
  const ownedTracks = allTracks.filter((rt) => ownedReleaseIds.has(rt.release_id));
  if (!ownedTracks.length) return NextResponse.json({ data: [] });

  // Get master titles + artist names
  const masterIds = [...new Set(
    (releases ?? []).map((r) => r.master_id).filter((id): id is number => id !== null)
  )];
  const { data: masters, error: masterErr } = await (db
    .from("masters")
    .select("id, title, artists:main_artist_id(name)")
    .in("id", masterIds)
    .limit(200) as unknown as Promise<{
      data: Array<{ id: number; title: string; artists: { name: string } | null }> | null;
      error: { message: string } | null;
    }>);

  if (masterErr) return NextResponse.json({ error: masterErr.message }, { status: 500 });

  const releaseToMaster = new Map((releases ?? []).map((r) => [r.id, r.master_id]));
  const releaseFormats = new Map((releases ?? []).map((r) => [r.id, r.format_details]));
  const masterMap = new Map((masters ?? []).map((m) => [m.id, m]));

  // Extract a short format label from format_details (e.g. ['7"', 'Single'])
  function extractFormatLabel(details: string[] | null | undefined): string | null {
    if (!Array.isArray(details) || details.length === 0) return null;
    if (details.includes('7"')) return '7"';
    if (details.includes('10"')) return '10"';
    if (details.includes('12"')) return '12"';
    return null;
  }

  // Group owned tracks by canonical recording_id (or release_track id as fallback)
  const qLower = q.toLowerCase();
  type Appearance = {
    inventory_id: number;
    release_id: number;
    release_track_id: number;
    album: string;
    format: string | null;
    side: string | null;
    position: string | null;
  };
  type SongResult = {
    recording_id: number;
    title: string;
    artist: string;
    relevance: number; // 0=exact, 1=starts-with, 2=contains
    appearances: Appearance[];
  };

  const songMap = new Map<number, SongResult>();

  for (const rt of ownedTracks) {
    const groupKey = rt.recording_id ?? rt.id;
    const masterId = releaseToMaster.get(rt.release_id);
    const master = masterId ? masterMap.get(masterId) : undefined;
    const inventoryId = inventoryByRelease.get(rt.release_id) ?? 0;
    const trackTitle = rt.title_override || rt.recording_title || "";
    const artist = rt.track_artist || master?.artists?.name || "";
    const album = master?.title || "";
    const format = extractFormatLabel(releaseFormats.get(rt.release_id) ?? null);

    const titleLower = trackTitle.toLowerCase();
    const relevance = titleLower === qLower ? 0 : titleLower.startsWith(qLower) ? 1 : 2;

    if (!songMap.has(groupKey)) {
      songMap.set(groupKey, {
        recording_id: groupKey,
        title: trackTitle,
        artist,
        relevance,
        appearances: [],
      });
    }

    const song = songMap.get(groupKey)!;
    // Keep best relevance score across all appearances
    if (relevance < song.relevance) song.relevance = relevance;

    song.appearances.push({
      inventory_id: inventoryId,
      release_id: rt.release_id,
      release_track_id: rt.id,
      album,
      format,
      side: rt.side,
      position: rt.position,
    });
  }

  // Sort songs by relevance then title, return top 10
  const songs = [...songMap.values()].sort((a, b) => {
    if (a.relevance !== b.relevance) return a.relevance - b.relevance;
    return a.title.localeCompare(b.title);
  });

  return NextResponse.json({ data: songs.slice(0, 10) });
}
