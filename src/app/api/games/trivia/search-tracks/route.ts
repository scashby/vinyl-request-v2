// @ts-nocheck — recordings / release_tracks / releases / inventory / masters not in TriviaDatabase; use supabaseAdmin
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ data: [] });

  const db = supabaseAdmin as unknown as { from: (t: string) => unknown };

  // 1. Find recordings matching the title
  const { data: recordings, error: recErr } = await (db
    .from("recordings")
    .select("id, title, track_artist")
    .ilike("title", `%${q}%`)
    .limit(50) as unknown as Promise<{
      data: Array<{ id: number; title: string; track_artist: string | null }> | null;
      error: { message: string } | null;
    }>);

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
  if (!recordings?.length) return NextResponse.json({ data: [] });

  const recordingIds = recordings.map((r) => r.id);

  // 2. Find release_tracks for those recordings
  const { data: releaseTracks, error: rtErr } = await (db
    .from("release_tracks")
    .select("id, release_id, recording_id, position, side, title_override")
    .in("recording_id", recordingIds)
    .limit(100) as unknown as Promise<{
      data: Array<{ id: number; release_id: number; recording_id: number; position: string | null; side: string | null; title_override: string | null }> | null;
      error: { message: string } | null;
    }>);

  if (rtErr) return NextResponse.json({ error: rtErr.message }, { status: 500 });
  if (!releaseTracks?.length) return NextResponse.json({ data: [] });

  const releaseIds = [...new Set(releaseTracks.map((rt) => rt.release_id))];

  // 3. Find inventory items (confirms ownership) + get master_id
  const [{ data: inventory, error: invErr }, { data: releases, error: relErr }] = await Promise.all([
    db
      .from("inventory")
      .select("id, release_id")
      .in("release_id", releaseIds)
      .limit(200) as unknown as Promise<{
        data: Array<{ id: number; release_id: number }> | null;
        error: { message: string } | null;
      }>,
    db
      .from("releases")
      .select("id, master_id")
      .in("id", releaseIds)
      .limit(100) as unknown as Promise<{
        data: Array<{ id: number; master_id: number | null }> | null;
        error: { message: string } | null;
      }>,
  ]);

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

  const ownedReleaseIds = new Set((inventory ?? []).map((i) => i.release_id));
  const ownedReleaseTracks = releaseTracks.filter((rt) => ownedReleaseIds.has(rt.release_id));
  if (!ownedReleaseTracks.length) return NextResponse.json({ data: [] });

  // 4. Get master titles + artist names
  const masterIds = [...new Set(
    (releases ?? []).map((r) => r.master_id).filter((id): id is number => id !== null)
  )];
  const { data: masters, error: masterErr } = await (db
    .from("masters")
    .select("id, title, main_artist_id, artists:main_artist_id(name)")
    .in("id", masterIds)
    .limit(100) as unknown as Promise<{
      data: Array<{ id: number; title: string; main_artist_id: number | null; artists: { name: string } | null }> | null;
      error: { message: string } | null;
    }>);

  if (masterErr) return NextResponse.json({ error: masterErr.message }, { status: 500 });

  // Build lookup maps
  const releaseToMaster = new Map((releases ?? []).map((r) => [r.id, r.master_id]));
  const masterMap = new Map((masters ?? []).map((m) => [m.id, m]));
  const recordingMap = new Map(recordings.map((r) => [r.id, r]));
  const inventoryByRelease = new Map<number, number>();
  for (const inv of inventory ?? []) {
    if (!inventoryByRelease.has(inv.release_id)) {
      inventoryByRelease.set(inv.release_id, inv.id);
    }
  }

  const results = ownedReleaseTracks.slice(0, 20).map((rt) => {
    const rec = recordingMap.get(rt.recording_id);
    const masterId = releaseToMaster.get(rt.release_id);
    const master = masterId ? masterMap.get(masterId) : undefined;
    const inventoryId = inventoryByRelease.get(rt.release_id) ?? 0;
    const trackTitle = rt.title_override || rec?.title || "";
    const artist = rec?.track_artist || master?.artists?.name || "";
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
