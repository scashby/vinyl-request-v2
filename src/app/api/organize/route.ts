// src/app/api/organize/route.ts
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

type Body = {
  cursor?: number | null;
  limit?: number;
  scope?: {
    locationExact?: string; // FIXED: Was folderExact
    artistSearch?: string;
    titleSearch?: string;
  };
  base?: string;
  unknownLabel?: string;
  dryRun?: boolean;
};

function sanitize(text: string) {
  return text.replace(/[^A-Za-z0-9 _&()+.\-]/g, "").trim() || "(unknown)";
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const limit = Math.min(Math.max(Number(body.limit ?? 500), 50), 2000);
  const cursor = Number(body.cursor ?? 0);
  const base = (body.base ?? "vinyl").replace(/\/+$/, "");
  const unknown = body.unknownLabel ?? "(unknown)";
  const dry = !!body.dryRun;

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      id,
      location,
      release:releases (
        master:masters (
          title,
          genres,
          artist:artists ( name )
        )
      )
    `)
    .gt("id", cursor)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const s = body.scope ?? {};
  const rows = (data ?? []).map((row) => {
    const release = row.release as { master?: { title?: string | null; genres?: string[] | null; artist?: { name?: string | null } | null } | null } | null;
    const master = release?.master;
    return {
      id: row.id as number,
      location: row.location as string | null,
      genres: master?.genres ?? [],
      artist: master?.artist?.name ?? '',
      title: master?.title ?? '',
    };
  }).filter((row) => {
    if (s.locationExact && s.locationExact !== 'all' && row.location !== s.locationExact) return false;
    if (s.artistSearch && !row.artist.toLowerCase().includes(s.artistSearch.toLowerCase())) return false;
    if (s.titleSearch && !row.title.toLowerCase().includes(s.titleSearch.toLowerCase())) return false;
    return true;
  });
  if (!rows.length) {
    return NextResponse.json({ moved_known: 0, moved_unknown: 0, scanned: 0, nextCursor: null });
  }

  let moved_known = 0;
  let moved_unknown = 0;
  let scanned = 0;
  let lastId = cursor;

  for (const r of rows) {
    scanned++;
    lastId = r.id as number;

    // FIXED: Use genres array
    const first = Array.isArray(r.genres) && r.genres.length
      ? String(r.genres[0])
      : null;

    const group = first ? sanitize(first) : unknown;
    const dest = `${base}/${group}`;

    if (dry) {
      if (first) moved_known++; else moved_unknown++;
      continue;
    }

    // FIXED: Update location column
    const { error: upErr } = await supabase
      .from("inventory")
      .update({ location: dest })
      .eq("id", r.id as number);

    if (!upErr) {
      if (first) moved_known++; else moved_unknown++;
    }
  }

  return NextResponse.json({
    moved_known,
    moved_unknown,
    scanned,
    nextCursor: rows.length < limit ? null : lastId,
  });
}
// AUDIT: inspected, no changes.
