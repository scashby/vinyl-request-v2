import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CollectionRow = {
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

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const UA = "DWD-Discogs-Enrichment/1.0";
const BASE = "https://api.discogs.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<{ code: number; body?: T }> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Authorization: `Discogs token=${DISCOGS_TOKEN}` },
      });
      if (res.status === 200) return { code: 200, body: (await res.json()) as T };
      if ([429, 500, 502, 503, 504].includes(res.status)) { await sleep(800 * attempt); continue; }
      return { code: res.status };
    } catch {
      await sleep(800 * attempt);
    }
  }
  return { code: 599 };
}

function pick(r?: DiscogsRelease): { genres: string[]; styles: string[] } {
  const genres = Array.isArray(r?.genres) ? r!.genres.filter(Boolean).map(String) : [];
  const styles = Array.isArray(r?.styles) ? r!.styles.filter(Boolean).map(String) : [];
  return { genres, styles };
}
function yearInt(text: string | null): number | undefined {
  const m = (text ?? "").match(/\b(\d{4})\b/);
  return m ? Number(m[1]) : undefined;
}

export async function POST() {
  if (!DISCOGS_TOKEN) {
    return NextResponse.json({ error: "Missing Discogs token" }, { status: 500 });
  }

  // pull a batch that still needs enrichment
  const { data, error } = await supabaseAdmin
    .from("collection")
    .select("id,artist,title,year,discogs_release_id")
    .or("discogs_genres.is.null,discogs_styles.is.null")
    .limit(50);

  if (error) return NextResponse.json({ error }, { status: 500 });
  const rows = (data ?? []) as CollectionRow[];

  let updated = 0;

  for (const row of rows) {
    let genres: string[] = [];
    let styles: string[] = [];

    // 1) try explicit release
    if (row.discogs_release_id) {
      const rel = await getJson<DiscogsRelease>(`${BASE}/releases/${encodeURIComponent(row.discogs_release_id)}`);
      if (rel.code === 200 && rel.body) ({ genres, styles } = pick(rel.body));
      await sleep(1200);
    }

    // 2) fallback search
    if (!(genres.length || styles.length) && (row.artist || row.title)) {
      const params = new URLSearchParams({
        artist: row.artist ?? "",
        release_title: row.title ?? "",
        type: "release",
        per_page: "1",
        page: "1",
      });
      const yi = yearInt(row.year);
      if (yi) params.set("year", String(yi));

      const sr = await getJson<DiscogsSearchResponse>(`${BASE}/database/search?${params.toString()}`);
      if (sr.code === 200 && sr.body?.results?.length) {
        const top = sr.body.results[0];
        if (top.resource_url) {
          const full = await getJson<DiscogsRelease>(top.resource_url);
          if (full.code === 200 && full.body) ({ genres, styles } = pick(full.body));
        } else {
          genres = Array.isArray(top.genre) ? top.genre.filter(Boolean).map(String) : [];
          styles = Array.isArray(top.style) ? top.style.filter(Boolean).map(String) : [];
        }
      }
      await sleep(1200);
    }

    if (genres.length || styles.length) {
      await supabaseAdmin
        .from("collection")
        .update({
          discogs_genres: genres.length ? genres : null,
          discogs_styles: styles.length ? styles : null,
        })
        .eq("id", row.id);
      updated++;
    }
  }

  return NextResponse.json({ updated, scanned: rows.length });
}
