import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface CollectionRow {
  id: number;
  artist: string | null;
  title: string | null;
  year: string | null;
  discogs_release_id: string | null;
}

interface DiscogsRelease {
  genres?: string[];
  styles?: string[];
}

interface DiscogsSearchItem {
  resource_url?: string;
  genre?: string[];
  style?: string[];
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchItem[];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;

const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

const UA = "DWD-GenreStyle-Enricher/1.0";
const BASE = "https://api.discogs.com";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpGetJson<T>(url: string): Promise<{ code: number; body?: T }> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Authorization: `Discogs token=${DISCOGS_TOKEN}`,
        },
      });

      if (resp.status === 200) {
        const json = (await resp.json()) as T;
        return { code: 200, body: json };
      }

      if ([429, 500, 502, 503, 504].includes(resp.status)) {
        await sleep(1000 * attempt);
        continue;
      }

      return { code: resp.status };
    } catch {
      await sleep(1000 * attempt);
    }
  }
  return { code: 599 };
}

function pickGenresStyles(r: DiscogsRelease | undefined): { genres: string[]; styles: string[] } {
  const genres = Array.isArray(r?.genres) ? r!.genres.filter(Boolean).map(String) : [];
  const styles = Array.isArray(r?.styles) ? r!.styles.filter(Boolean).map(String) : [];
  return { genres, styles };
}

function toYearInt(text: string | null): number | undefined {
  const m = (text ?? "").match(/\b(\d{4})\b/);
  return m ? Number(m[1]) : undefined;
}

export async function POST() {
  if (!DISCOGS_TOKEN) {
    return NextResponse.json(
      { error: "Missing Discogs token. Add DISCOGS_TOKEN (server-only) or NEXT_PUBLIC_DISCOGS_TOKEN." },
      { status: 500 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("collection")
    .select("id,artist,title,year,discogs_release_id")
    .or("discogs_genres.is.null,discogs_styles.is.null")
    .limit(50);

  if (error) return NextResponse.json({ error }, { status: 500 });
  const rows: CollectionRow[] = (data ?? []) as CollectionRow[];

  let updated = 0;

  for (const row of rows) {
    let genres: string[] = [];
    let styles: string[] = [];
    let source: string | null = null;
    let notes: string | null = null;

    if (row.discogs_release_id) {
      const rel = await httpGetJson<DiscogsRelease>(`${BASE}/releases/${encodeURIComponent(row.discogs_release_id)}`);
      if (rel.code === 200 && rel.body) {
        const gs = pickGenresStyles(rel.body);
        genres = gs.genres;
        styles = gs.styles;
        if (genres.length || styles.length) source = "release";
      } else {
        notes = `release ${rel.code}`;
      }
      await sleep(1400);
    }

    if (!(genres.length || styles.length) && (row.artist || row.title)) {
      const params = new URLSearchParams({
        artist: row.artist ?? "",
        release_title: row.title ?? "",
        type: "release",
        per_page: "1",
        page: "1",
      });
      const yi = toYearInt(row.year);
      if (yi) params.set("year", String(yi));

      const srch = await httpGetJson<DiscogsSearchResponse>(`${BASE}/database/search?${params.toString()}`);
      if (srch.code === 200 && srch.body?.results && srch.body.results.length > 0) {
        const top: DiscogsSearchItem = srch.body.results[0];

        if (top.resource_url) {
          const full = await httpGetJson<DiscogsRelease>(top.resource_url);
          if (full.code === 200 && full.body) {
            const gs = pickGenresStyles(full.body);
            genres = gs.genres;
            styles = gs.styles;
            if (genres.length || styles.length) source = "search";
          } else {
            notes = notes ? `${notes} | follow-up ${full.code}` : `follow-up ${full.code}`;
          }
        } else {
          const g = Array.isArray(top.genre) ? top.genre.filter(Boolean).map(String) : [];
          const s = Array.isArray(top.style) ? top.style.filter(Boolean).map(String) : [];
          genres = g;
          styles = s;
          if (genres.length || styles.length) source = "search";
        }
      } else {
        notes = notes ? `${notes} | search ${srch.code}` : `search ${srch.code}`;
      }
      await sleep(1400);
    }

    const { error: rpcErr } = await supabaseAdmin.rpc("set_discogs_metadata", {
      p_id: row.id,
      p_genres: genres.length ? genres : null,
      p_styles: styles.length ? styles : null,
      p_source: source,
      p_notes: notes,
    });

    if (!rpcErr) updated += 1;
  }

  return NextResponse.json({ updated });
}
