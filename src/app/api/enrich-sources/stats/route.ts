// src/app/api/enrich-sources/stats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch all collection items to calculate stats
    // We select specific fields to minimize data transfer
    const { data: albums, error } = await supabase
      .from('collection')
      .select(`
        id,
        folder,
        image_url,
        back_image_url,
        musicians,
        producers,
        tracklists,
        tempo,
        genres,
        spotify_id,
        apple_music_id,
        lastfm_url,
        barcode,
        labels,
        original_release_date,
        cat_no
      `);

    if (error) throw error;
    if (!albums) return NextResponse.json({ success: true, stats: null });

    // Initialize Counters
    let fullyEnriched = 0;
    let needsEnrichment = 0;
    
    let missingArtwork = 0;
    let missingBackCover = 0;
    
    let missingCredits = 0;
    let missingMusicians = 0;
    let missingProducers = 0;
    
    let missingTracklists = 0;
    
    let missingAudioAnalysis = 0;
    let missingTempo = 0;
    
    let missingGenres = 0;
    
    let missingStreamingLinks = 0;
    let missingSpotify = 0;
    
    let missingReleaseMetadata = 0;
    let missingCatalogNumber = 0;

    const folders = new Set<string>();

    albums.forEach(album => {
      if (album.folder) folders.add(album.folder);

      // 1. ARTWORK
      const hasFront = !!album.image_url;
      const hasBack = !!album.back_image_url;
      if (!hasFront || !hasBack) {
        if (!hasFront) missingArtwork++; // Main stat tracks front cover
        if (!hasBack) missingBackCover++;
      }

      // 2. CREDITS
      // Check if array exists and has length > 0
      const hasMusicians = Array.isArray(album.musicians) && album.musicians.length > 0;
      const hasProducers = Array.isArray(album.producers) && album.producers.length > 0;
      if (!hasMusicians || !hasProducers) {
        missingCredits++;
        if (!hasMusicians) missingMusicians++;
        if (!hasProducers) missingProducers++;
      }

      // 3. TRACKLISTS
      const hasTracks = Array.isArray(album.tracklists) && album.tracklists.length > 0;
      if (!hasTracks) missingTracklists++;

      // 4. AUDIO ANALYSIS
      const hasTempo = album.tempo !== null && album.tempo !== 0;
      if (!hasTempo) {
        missingAudioAnalysis++;
        missingTempo++;
      }

      // 5. GENRES
      const hasGenres = Array.isArray(album.genres) && album.genres.length > 0;
      if (!hasGenres) missingGenres++;

      // 6. STREAMING
      const hasSpotify = !!album.spotify_id;
      const hasApple = !!album.apple_music_id;
      const hasLastfm = !!album.lastfm_url;
      
      // LOGIC UPDATE: Only count as "Missing Streaming Links" if ALL are missing
      if (!hasSpotify && !hasApple && !hasLastfm) {
        missingStreamingLinks++;
      }

      // We track missingSpotify separately for specific reporting
      if (!hasSpotify) {
        missingSpotify++;
      }

      // 7. RELEASE METADATA
      const hasBarcode = !!album.barcode;
      const hasLabel = Array.isArray(album.labels) && album.labels.length > 0;
      const hasOriginalDate = !!album.original_release_date;
      
      // Note: 'cat_no' excluded from enrichment requirements as requested
      if (!hasBarcode || !hasLabel || !hasOriginalDate) {
        missingReleaseMetadata++;
      }

      if (!album.cat_no) missingCatalogNumber++;

      // 8. TOTAL SCORE
      // An album is "Fully Enriched" if it passes all MAIN checks
      // UPDATED: Streaming is satisfied if ANY source exists (Spotify OR Apple OR LastFM)
      const isComplete = 
        hasFront && hasBack &&
        hasMusicians && hasProducers &&
        hasTracks &&
        hasTempo &&
        hasGenres &&
        (hasSpotify || hasApple || hasLastfm) && 
        (hasBarcode && hasLabel && hasOriginalDate);

      if (isComplete) fullyEnriched++;
      else needsEnrichment++;
    });

    const stats = {
      total: albums.length,
      fullyEnriched,
      needsEnrichment,
      
      missingArtwork,
      missingBackCover,
      
      missingCredits,
      missingMusicians,
      missingProducers,
      
      missingTracklists,
      
      missingAudioAnalysis,
      missingTempo,
      
      missingGenres,
      
      missingStreamingLinks,
      missingSpotify,
      
      missingReleaseMetadata,
      missingCatalogNumber
    };

    return NextResponse.json({ 
      success: true, 
      stats,
      folders: Array.from(folders).sort()
    });

  } catch (error) {
    console.error("Stats Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}