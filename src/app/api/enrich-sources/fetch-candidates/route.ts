// src/app/api/enrich-sources/fetch-candidates/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
  fetchSpotifyData, 
  fetchMusicBrainzData, 
  fetchDiscogsData,
  fetchLastFmData,
  fetchAppleMusicData,
  fetchCoverArtData,
  fetchWikipediaData,
  fetchGeniusData,
  type CandidateData,
  type EnrichmentResult
} from "lib/enrichment-utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: Determine if an album needs specific services
function needsService(album: Record<string, unknown>, service: string): boolean {
  switch (service) {
    case 'musicbrainz':
      const musicians = album.musicians as unknown[] | undefined;
      const producers = album.producers as unknown[] | undefined;
      return !album.musicbrainz_id || (!musicians?.length && !producers?.length);
    case 'spotify':
      return !album.spotify_id || !album.spotify_release_date; 
    case 'discogs':
      const genres = album.genres as unknown[] | undefined;
      return !album.discogs_release_id || !genres?.length;
    case 'coverArt':
      return !album.image_url;
    default:
      return true; 
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      albumIds,      // Option A: Specific IDs
      cursor = 0,    // Option B: Pagination Cursor
      limit = 10,    // Option B: Batch Size
      folder,        // Option B: Filter by Folder
      services       // Selected Services map
    } = body;

    let targetAlbums: Record<string, unknown>[] = [];
    let nextCursor = null;

    // --- STRATEGY 1: Explicit IDs (User selected specific rows) ---
    if (albumIds && albumIds.length > 0) {
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .in('id', albumIds);
        
      if (error) throw error;
      targetAlbums = data || [];
    } 
    // --- STRATEGY 2: Batch Discovery (Scan mode) ---
    else {
      let query = supabase
        .from('collection')
        .select('*')
        .gt('id', cursor)
        .order('id', { ascending: true })
        .limit(limit);

      if (folder) query = query.eq('folder', folder);

      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];

      // FIXED: Calculate nextCursor based on the RAW fetched data, not the filtered targets.
      // This ensures we always advance the cursor, even if we skip all items in this batch.
      if (fetched.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextCursor = (fetched[fetched.length - 1] as any).id;
      }

      // Filter in memory to find ones that actually need help based on selected services
      targetAlbums = fetched.filter(album => {
        return Object.entries(services).some(([serviceKey, isEnabled]) => {
          return isEnabled && needsService(album, serviceKey);
        });
      });
    }

    if (!targetAlbums.length) {
      // Return the new cursor even if results are empty, so client knows where to continue
      return NextResponse.json({ 
        success: true, 
        results: [], 
        nextCursor: nextCursor,
        message: "No albums found needing enrichment in this batch." 
      });
    }

    // --- EXECUTION: Fetch Data for Targets ---
    const results = [];

    for (const album of targetAlbums) {
      const candidates: Record<string, CandidateData> = {};
      const promises: Promise<EnrichmentResult | null>[] = [];

      // Type cast album for safer access in fetchers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedAlbum = album as any;

      // 1. Core Metadata
      if (services.musicbrainz) promises.push(fetchMusicBrainzData(typedAlbum));
      if (services.discogs) promises.push(fetchDiscogsData(typedAlbum));
      
      // 2. Streaming
      if (services.spotify) promises.push(fetchSpotifyData(typedAlbum));
      if (services.appleMusicEnhanced) promises.push(fetchAppleMusicData(typedAlbum));
      
      // 3. Supplemental
      if (services.lastfm) promises.push(fetchLastFmData(typedAlbum));
      if (services.wikipedia) promises.push(fetchWikipediaData(typedAlbum));
      if (services.genius) promises.push(fetchGeniusData(typedAlbum));
      if (services.coverArt) promises.push(fetchCoverArtData(typedAlbum));

      // Wait for all services for this album
      const settled = await Promise.allSettled(promises);
      
      settled.forEach(res => {
        if (res.status === 'fulfilled' && res.value && res.value.success && res.value.data) {
          candidates[res.value.source] = res.value.data;
        }
      });

      // Only add to results if we found SOMETHING
      if (Object.keys(candidates).length > 0) {
        results.push({
          album,
          candidates
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      results, 
      nextCursor: nextCursor,
      processedCount: targetAlbums.length
    });

  } catch (error) {
    console.error("Enrichment Batch Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}