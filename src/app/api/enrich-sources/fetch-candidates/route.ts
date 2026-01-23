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
  fetchWhoSampledData,
  fetchSecondHandSongsData,
  fetchTheAudioDBData,
  fetchWikidataData,
  fetchSetlistFmData,
  fetchRateYourMusicData,
  fetchFanartTvData,
  fetchDeezerData,
  fetchMusixmatchData,
  fetchPopsikeData,
  fetchPitchforkData,
  type CandidateData, 
  type EnrichmentResult
} from "lib/enrichment-utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to chunk arrays for concurrency control
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      albumIds,
      cursor = 0,
      limit = 10,
      location, // FIXED: Was 'folder'
      services,
      autoSnooze = false
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

      // FIXED: Use 'location' column instead of 'folder'
      if (location) query = query.eq('location', location);

      // SERVER-SIDE SNOOZE FILTERING
      if (autoSnooze) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Select items where last_reviewed_at is NULL OR older than 30 days
        query = query.or(`last_reviewed_at.is.null,last_reviewed_at.lt.${thirtyDaysAgo.toISOString()}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];

      // Always advance cursor based on raw fetch to ensure progress
      if (fetched.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextCursor = (fetched[fetched.length - 1] as any).id;
      }

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

    const results: { album: Record<string, unknown>, candidates: Record<string, CandidateData> }[] = [];

    // --- UPDATED CONCURRENCY LOGIC ---
    // Process albums in chunks of 5 to speed up response time while respecting rate limits
    const CHUNK_SIZE = 5;
    const chunks = chunkArray(targetAlbums, CHUNK_SIZE);

    for (const chunk of chunks) {
       const chunkPromises = chunk.map(async (album) => {
          const candidates: Record<string, CandidateData> = {};
          const promises: Promise<EnrichmentResult | null>[] = [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedAlbum = album as any;

          // Always fetch requested services
          if (services.musicbrainz) promises.push(fetchMusicBrainzData(typedAlbum));
          if (services.discogs) promises.push(fetchDiscogsData(typedAlbum));
          if (services.spotify) promises.push(fetchSpotifyData(typedAlbum));
          if (services.appleMusicEnhanced) promises.push(fetchAppleMusicData(typedAlbum));
          if (services.lastfm) promises.push(fetchLastFmData(typedAlbum));
          if (services.wikipedia) promises.push(fetchWikipediaData(typedAlbum));
          if (services.genius) promises.push(fetchGeniusData(typedAlbum));
          if (services.coverArt) promises.push(fetchCoverArtData(typedAlbum));
          if (services.whosampled) promises.push(fetchWhoSampledData(typedAlbum));
          if (services.secondhandsongs) promises.push(fetchSecondHandSongsData(typedAlbum));
          if (services.theaudiodb) promises.push(fetchTheAudioDBData(typedAlbum));
          if (services.wikidata) promises.push(fetchWikidataData(typedAlbum));
          if (services.setlistfm) promises.push(fetchSetlistFmData(typedAlbum));
          if (services.rateyourmusic) promises.push(fetchRateYourMusicData(typedAlbum));
          if (services.fanarttv) promises.push(fetchFanartTvData(typedAlbum));
          if (services.deezer) promises.push(fetchDeezerData(typedAlbum));
          if (services.musixmatch) promises.push(fetchMusixmatchData(typedAlbum));
          if (services.popsike) promises.push(fetchPopsikeData(typedAlbum));
          if (services.pitchfork) promises.push(fetchPitchforkData(typedAlbum));

          const settled = await Promise.allSettled(promises);
          
          settled.forEach(res => {
            if (res.status === 'fulfilled' && res.value && res.value.success && res.value.data) {
              candidates[res.value.source] = res.value.data;
            }
          });

          if (Object.keys(candidates).length > 0) {
            return { album, candidates };
          }
          return null;
       });

       // Wait for this chunk of albums to complete
       const chunkResults = await Promise.all(chunkPromises);
       
       chunkResults.forEach(res => {
          if (res) results.push(res);
       });
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