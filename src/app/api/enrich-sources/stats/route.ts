import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // 1. Fetch Albums
    // AUDIT FIX: Added spine, inner, vinyl columns to query
    const { data: albums, error } = await supabase
      .from('collection')
      .select(`
        id,
        folder,
        image_url,
        back_image_url,
        spine_image_url,
        inner_sleeve_images,
        vinyl_label_images,
        musicians,
        producers,
        tempo_bpm, 
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

    // 2. Fetch Track Data (Source of Truth)
    const { data: trackRows, error: trackError } = await supabase
      .from('tracks')
      .select('album_id');
    
    if (trackError) console.error("Track Fetch Error:", trackError);

    const albumsWithTracks = new Set(trackRows?.map(t => String(t.album_id)) || []);

    // Initialize Counters
    let fullyEnriched = 0;
    let needsEnrichment = 0;
    
    let missingArtwork = 0;
    let missingBackCover = 0;
    let missingSpine = 0;        // New
    let missingInnerSleeve = 0;  // New
    let missingVinylLabel = 0;   // New
    
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
      // Strict check: We now require ALL 5 components for "Complete Artwork"
      const hasFront = !!album.image_url;
      const hasBack = !!album.back_image_url;
      const hasSpine = !!album.spine_image_url;
      // Check for non-empty arrays for JSONB image fields
      const hasInner = Array.isArray(album.inner_sleeve_images) && album.inner_sleeve_images.length > 0;
      const hasVinyl = Array.isArray(album.vinyl_label_images) && album.vinyl_label_images.length > 0;

      if (!hasFront || !hasBack || !hasSpine || !hasInner || !hasVinyl) {
        missingArtwork++; 
        if (!hasFront) { /* Tracked by main missingArtwork usually, but logic implies we just want the agg here */ }
        if (!hasBack) missingBackCover++;
        if (!hasSpine) missingSpine++;
        if (!hasInner) missingInnerSleeve++;
        if (!hasVinyl) missingVinylLabel++;
      }

      // 2. CREDITS
      const hasMusicians = Array.isArray(album.musicians) && album.musicians.length > 0;
      const hasProducers = Array.isArray(album.producers) && album.producers.length > 0;
      if (!hasMusicians || !hasProducers) {
        missingCredits++;
        if (!hasMusicians) missingMusicians++;
        if (!hasProducers) missingProducers++;
      }

      // 3. TRACKLISTS (Using separate table)
      const hasTracks = albumsWithTracks.has(String(album.id));
      if (!hasTracks) missingTracklists++;

      // 4. AUDIO ANALYSIS (Using tempo_bpm)
      const hasTempo = album.tempo_bpm !== null && album.tempo_bpm !== 0;
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
      
      // LOGIC: Only "Missing" if ALL sources are empty
      if (!hasSpotify && !hasApple && !hasLastfm) {
        missingStreamingLinks++;
      }

      if (!hasSpotify) missingSpotify++;

      // 7. RELEASE METADATA
      const hasBarcode = !!album.barcode;
      const hasLabel = Array.isArray(album.labels) && album.labels.length > 0;
      const hasOriginalDate = !!album.original_release_date;
      
      // LOGIC: 'cat_no' excluded from "Needs Enrichment" check
      if (!hasBarcode || !hasLabel || !hasOriginalDate) {
        missingReleaseMetadata++;
      }

      if (!album.cat_no) missingCatalogNumber++;

      // 8. TOTAL SCORE
      // "Fully Enriched" def: Has ALL assets + ANY streaming link + Metadata
      const isComplete = 
        (hasFront && hasBack && hasSpine && hasInner && hasVinyl) &&
        (hasMusicians && hasProducers) &&
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
      missingSpine,       // New
      missingInnerSleeve, // New
      missingVinylLabel,  // New
      
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