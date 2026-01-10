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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      albumIds,
      cursor = 0,
      limit = 10,
      folder,
      services
    } = body;

    let targetAlbums: Record<string, unknown>[] = [];
    let nextCursor = null;

    if (albumIds && albumIds.length > 0) {
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .in('id', albumIds);
        
      if (error) throw error;
      targetAlbums = data || [];
    } else {
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

      // Always advance cursor based on raw fetch to ensure progress
      if (fetched.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextCursor = (fetched[fetched.length - 1] as any).id;
      }

      // NO FILTERING: We process everything we fetched.
      // This ensures we check for upgrades even if data exists.
      targetAlbums = fetched;
    }

    if (!targetAlbums.length) {
      return NextResponse.json({ 
        success: true, 
        results: [], 
        nextCursor: nextCursor,
        message: "No albums found in this batch." 
      });
    }

    const results = [];

    for (const album of targetAlbums) {
      const candidates: Record<string, CandidateData> = {};
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedAlbum = album as any;

      // 1. STAGE ONE: Core Identities (MusicBrainz)
      // We do this first because CoverArtArchive needs the MBID to work.
      let mbid = typedAlbum.musicbrainz_id;
      
      if (services.musicbrainz && !mbid) {
        const mbRes = await fetchMusicBrainzData(typedAlbum);
        if (mbRes.success && mbRes.data) {
          candidates['musicbrainz'] = mbRes.data;
          mbid = mbRes.data.musicbrainz_id; // Capture for CAA usage in Stage 2
        }
      }

      // 2. STAGE TWO: Content & Context
      const secondaryPromises: Promise<EnrichmentResult | null>[] = [];
      
      if (services.discogs) secondaryPromises.push(fetchDiscogsData(typedAlbum));
      if (services.spotify) secondaryPromises.push(fetchSpotifyData(typedAlbum));
      if (services.appleMusicEnhanced) secondaryPromises.push(fetchAppleMusicData(typedAlbum));
      if (services.lastfm) secondaryPromises.push(fetchLastFmData(typedAlbum));
      if (services.wikipedia) secondaryPromises.push(fetchWikipediaData(typedAlbum));
      if (services.genius) secondaryPromises.push(fetchGeniusData(typedAlbum));
      
      // Now we can check CoverArt, potentially using the ID we just found
      if (services.coverArt) {
         // Pass the potentially newly found MBID
         secondaryPromises.push(fetchCoverArtData({ ...typedAlbum, musicbrainz_id: mbid || typedAlbum.musicbrainz_id }));
      }

      const settled = await Promise.allSettled(secondaryPromises);
      
      settled.forEach(res => {
        if (res.status === 'fulfilled' && res.value && res.value.success && res.value.data) {
          candidates[res.value.source] = res.value.data;
        }
      });

      if (Object.keys(candidates).length > 0) {
        results.push({ album, candidates });
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