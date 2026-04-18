// @ts-nocheck — release_tracks / releases / inventory / masters not in TriviaDatabase; use supabaseAdmin
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";
import { isForSaleInventory } from "src/lib/saleUtils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const db = supabaseAdmin as unknown as { from: (t: string) => unknown };

  // Search release_tracks directly by title — no collection-size limit.
  // Two queries in parallel: one by title_override, one by recordings.title via left join.
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

  // Fetch inventory (no status pre-filter — isForSaleInventory covers all sale cases)
  // and release→master mapping in parallel
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
      .select("id, master_id")
      .in("id", releaseIds)
      .limit(200) as unknown as Promise<{
        data: Array<{ id: number; master_id: number | null }> | null;
        error: { message: string } | null;
      }>,
  ]);

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

  // Exclude for-sale inventory
  const ownedInventory = (inventory ?? []).filter((inv) => !isForSaleInventory(inv));
  const ownedReleaseIds = new Set(ownedInventory.map((i) => i.release_id));
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
  const masterMap = new Map((masters ?? []).map((m) => [m.id, m]));
  const inventoryByRelease = new Map<number, number>();
  for (const inv of ownedInventory) {
    if (!inventoryByRelease.has(inv.release_id)) {
      inventoryByRelease.set(inv.release_id, inv.id);
    }
  }

  // Sort: exact title matches first, then starts-with, then contains
  const qLower = q.toLowerCase();
  ownedTracks.sort((a, b) => {
    const aTitle = (a.title_override || a.recording_title || "").toLowerCase();
    const bTitle = (b.title_override || b.recording_title || "").toLowerCase();
    const aExact = aTitle === qLower ? 0 : aTitle.startsWith(qLower) ? 1 : 2;
    const bExact = bTitle === qLower ? 0 : bTitle.startsWith(qLower) ? 1 : 2;
    return aExact - bExact;
  });

  const results = ownedTracks.slice(0, 20).map((rt) => {
    const masterId = releaseToMaster.get(rt.release_id);
    const master = masterId ? masterMap.get(masterId) : undefined;
    const inventoryId = inventoryByRelease.get(rt.release_id) ?? 0;
    const trackTitle = rt.title_override || rt.recording_title || "";
    const artist = rt.track_artist || master?.artists?.name || "";
    const album = master?.title || "";

    return {
      inventory_id: inventoryId,
      release_id: rt.release_id,
      release_track_id: rt.id,
      artist,
      album,
      title: trackTitle,
      side: rt.side,
      position: rt.position,
      track_key: `rt-${rt.id}`,
    };
  });

  return NextResponse.json({ data: results });
}
