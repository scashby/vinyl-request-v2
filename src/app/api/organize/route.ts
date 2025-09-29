import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Body = {
  cursor?: number | null;
  limit?: number; // 50..2000 (default 500)
  scope?: {
    folderLike?: string;
    artistLike?: string;
    titleLike?: string;
  };
  base?: string;            // e.g. 'vinyl'
  unknownLabel?: string;    // default '(unknown)'
  dryRun?: boolean;         // preview only if true
};

function sanitize(text: string) {
  return text.replace(/[^A-Za-z0-9 _&()+.\-]/g, "").trim() || "(unknown)";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const limit = Math.min(Math.max(Number(body.limit ?? 500), 50), 2000);
  const cursor = Number(body.cursor ?? 0);
  const base = (body.base ?? "vinyl").replace(/\/+$/, "");
  const unknown = body.unknownLabel ?? "(unknown)";
  const dry = !!body.dryRun;

  let q = supabase
    .from("collection")
    .select("id,discogs_genres,folder,artist,title")
    .gt("id", cursor)
    .order("id", { ascending: true })
    .limit(limit);

  const s = body.scope ?? {};
  if (s.folderLike) q = q.like("folder", s.folderLike);
  if (s.artistLike) q = q.ilike("artist", s.artistLike);
  if (s.titleLike)  q = q.ilike("title", s.titleLike);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error }, { status: 500 });

  const rows = data ?? [];
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

    const first = Array.isArray(r.discogs_genres) && r.discogs_genres.length
      ? String(r.discogs_genres[0])
      : null;

    const group = first ? sanitize(first) : unknown;
    const dest = `${base}/${group}`;

    if (dry) {
      if (first) moved_known++; else moved_unknown++;
      continue;
    }

    const { error: upErr } = await supabase
      .from("collection")
      .update({ folder: dest })
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
