// src/app/api/enrich/route.ts - COMPLETE FILE WITH DECADE FIXES
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: number;
  artist: string | null;
  title: string | null;
  year: string | null;
  discogs_release_id: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
  master_release_id: string | null;
  master_release_date: string | null;
};

type DiscogsRelease = { 
  genres?: string[]; 
  styles?: string[];
  master_id?: number;
  master_url?: string;
};

type DiscogsMaster = {
  year?: string | number;
  main_release?: number;
};

type DiscogsSearchItem = { 
  resource_url?: string; 
  genre?: string[]; 
  style?: string[];
  master_id?: number;
  master_url?: string;
};

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
  master_id: r?.master_id || null,
  master_url: r?.master_url || null
});

const yearInt = (y:string|null)=> (y||"").match(/\b(\d{4})\b/)?.[1];

// FIXED: Calculate decade from year string, preferring master release date
function calculateDecade(year: string | null): number | null {
  if (!year) return null;
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum)) return null;
  return Math.floor(yearNum / 10) * 10;
}

type Body = {
  cursor?: number|null;
  limit?: number;
  folderExact?: string;
  artistSearch?: string;
  titleSearch?: string;
};

export async function POST(req: Request) {
  if (!DISCOGS_TOKEN) return NextResponse.json({ error: "Missing Discogs token" }, { status: 500 });
  const b = (await req.json().catch(()=> ({}))) as Body;

  const limit = Math.min(Math.max(Number(b.limit ?? 60), 10), 250);
  const cursor = Number(b.cursor ?? 0);

  let q = supabase
    .from("collection")
    .select("id,artist,title,year,discogs_release_id,discogs_genres,discogs_styles,decade,master_release_id,master_release_date")
    .or("discogs_genres.is.null,discogs_styles.is.null,decade.is.null,master_release_date.is.null")
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
    
    // Determine what needs to be updated
    const needsGenres = !row.discogs_genres || row.discogs_genres.length === 0;
    const needsStyles = !row.discogs_styles || row.discogs_styles.length === 0;
    const needsDecade = !row.decade;
    const needsMasterDate = !row.master_release_date;
    
    // Skip if nothing needs updating
    if (!needsGenres && !needsStyles && !needsDecade && !needsMasterDate) continue;
    
    let genres: string[] = row.discogs_genres || [];
    let styles: string[] = row.discogs_styles || [];
    let master_id: string | null = row.master_release_id;
    let master_date: string | null = row.master_release_date;
    let decade: number | null = row.decade;

    // Fetch from Discogs if we need genres/styles/master
    if ((needsGenres || needsStyles || needsMasterDate) && row.discogs_release_id) {
      const rel = await getJson<DiscogsRelease>(`${BASE}/releases/${encodeURIComponent(row.discogs_release_id)}`);
      if (rel.ok) {
        const data = pick(rel.data);
        if (needsGenres) genres = data.genres;
        if (needsStyles) styles = data.styles;
        
        // Fetch master release date if we have a master_id
        if (needsMasterDate && (data.master_id || data.master_url)) {
          const masterId = data.master_id || data.master_url?.split('/').pop();
          if (masterId) {
            try {
              const masterRes = await getJson<DiscogsMaster>(`${BASE}/masters/${masterId}`);
              if (masterRes.ok && masterRes.data?.year) {
                master_id = String(masterId);
                master_date = String(masterRes.data.year);
              }
            } catch (err) {
              console.warn(`Failed to fetch master ${masterId}:`, err);
            }
            await sleep(1000);
          }
        }
      }
      await sleep(1000);
    }

    // If still missing, try search
    if ((needsGenres || needsStyles) && !(genres.length||styles.length) && (row.artist||row.title)) {
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
          if (full.ok) {
            const data = pick(full.data);
            if (needsGenres) genres = data.genres;
            if (needsStyles) styles = data.styles;
          }
        } else {
          if (needsGenres) genres = Array.isArray(top.genre) ? top.genre.filter(Boolean).map(String) : [];
          if (needsStyles) styles = Array.isArray(top.style) ? top.style.filter(Boolean).map(String) : [];
        }
      }
      await sleep(1000);
    }

    // FIXED: Calculate decade from master_release_date (original year) when available, fallback to pressing year
    if (needsDecade) {
      const yearToUse = master_date || row.master_release_date || row.year;
      if (yearToUse) {
        decade = calculateDecade(yearToUse);
      }
    }

    // Only update fields that were missing
    const updateData: Partial<Row> = {};
    if (needsGenres && genres.length) updateData.discogs_genres = genres;
    if (needsStyles && styles.length) updateData.discogs_styles = styles;
    if (needsDecade && decade) updateData.decade = decade;
    if (needsMasterDate && master_date) {
      updateData.master_release_id = master_id;
      updateData.master_release_date = master_date;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase.from("collection").update(updateData).eq("id", row.id);
      updated++;
    }
  }

  return NextResponse.json({
    updated, scanned,
    nextCursor: rows.length < limit ? null : lastId,
  });
}