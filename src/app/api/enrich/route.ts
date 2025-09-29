// Fixed API route: src/app/api/enrich/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: number;
  artist: string | null;
  title: string | null;
  year: string | null;
  discogs_release_id: string | null;
};

type DiscogsRelease = { genres?: string[]; styles?: string[] };
type DiscogsSearchItem = { resource_url?: string; genre?: string[]; style?: string[] };
type DiscogsSearchResponse = { results?: DiscogsSearchItem[] };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const UA = "DWD-Discogs-Enrichment/1.0";
const BASE = "https://api.discogs.com";
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

async function getJson<T>(url: string) {
  for (let a=1;a<=5;a++){
    try{
      const res = await fetch(url, { headers:{ "User-Agent": UA, Authorization:`Discogs token=${DISCOGS_TOKEN}` }});
      if (res.status===200) return {ok:true, data: await res.json() as T};
      if ([429,500,502,503,504].includes(res.status)) { await sleep(600*a); continue; }
      return {ok:false, status:res.status};
    } catch { await sleep(600*a); }
  }
  return {ok:false, status:599};
}

const pick = (r?:DiscogsRelease)=>({
  genres: Array.isArray(r?.genres)? r!.genres.filter(Boolean).map(String):[],
  styles: Array.isArray(r?.styles)? r!.styles.filter(Boolean).map(String):[],
});

const yearInt = (y:string|null)=> (y||"").match(/\b(\d{4})\b/)?.[1];

type Body = {
  cursor?: number|null;
  limit?: number;
  folderExact?: string;      // Exact folder match
  artistSearch?: string;      // Partial artist search
  titleSearch?: string;       // Partial title search
};

export async function POST(req: Request) {
  if (!DISCOGS_TOKEN) return NextResponse.json({ error: "Missing Discogs token" }, { status: 500 });
  const b = (await req.json().catch(()=> ({}))) as Body;

  const limit = Math.min(Math.max(Number(b.limit ?? 60), 10), 250);
  const cursor = Number(b.cursor ?? 0);

  let q = supabase
    .from("collection")
    .select("id,artist,title,year,discogs_release_id")
    .or("discogs_genres.is.null,discogs_styles.is.null")
    .gt("id", cursor)
    .order("id", { ascending: true })
    .limit(limit);

  // Apply user-friendly filters
  if (b.folderExact && b.folderExact !== 'all') {
    q = q.eq("folder", b.folderExact);
  }
  if (b.artistSearch) {
    q = q.ilike("artist", `%${b.artistSearch}%`);
  }
  if (b.titleSearch) {
    q = q.ilike("title", `%${b.titleSearch}%`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error }, { status: 500 });

  const rows = (data ?? []) as Row[];
  if (!rows.length) return NextResponse.json({ updated: 0, scanned: 0, nextCursor: null });

  let updated = 0, scanned = 0, lastId = cursor;

  for (const row of rows) {
    lastId = row.id; scanned++;
    let genres: string[] = []; let styles: string[] = [];

    if (row.discogs_release_id) {
      const rel = await getJson<DiscogsRelease>(`${BASE}/releases/${encodeURIComponent(row.discogs_release_id)}`);
      if (rel.ok) ({ genres, styles } = pick(rel.data));
      await sleep(1000);
    }

    if (!(genres.length||styles.length) && (row.artist||row.title)) {
      const params = new URLSearchParams({
        artist: row.artist ?? "",
        release_title: row.title ?? "",
        type: "release",
        per_page: "1",
        page: "1",
      });
      const yi = yearInt(row.year); if (yi) params.set("year", yi);
      const sr = await getJson<DiscogsSearchResponse>(`${BASE}/database/search?${params.toString()}`);
      if (sr.ok && sr.data?.results?.[0]) {
        const top = sr.data.results[0];
        if (top.resource_url) {
          const full = await getJson<DiscogsRelease>(top.resource_url);
          if (full.ok) ({ genres, styles } = pick(full.data));
        } else {
          genres = Array.isArray(top.genre) ? top.genre.filter(Boolean).map(String) : [];
          styles = Array.isArray(top.style) ? top.style.filter(Boolean).map(String) : [];
        }
      }
      await sleep(1000);
    }

    if (genres.length || styles.length) {
      await supabase.from("collection").update({
        discogs_genres: genres.length ? genres : null,
        discogs_styles: styles.length ? styles : null,
      }).eq("id", row.id);
      updated++;
    }
  }

  return NextResponse.json({
    updated, scanned,
    nextCursor: rows.length < limit ? null : lastId,
  });
}