import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
    console.error("Stats Error: Missing Supabase credentials.");
    return NextResponse.json(
      { success: false, error: "Missing Supabase credentials." },
      { status: 500 }
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey ?? anonKey!,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Fetch Albums
    const { data: albums, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          barcode,
          label,
          catalog_number,
          release_date,
          release_year,
          spotify_album_id,
          apple_music_id,
          master:masters (
            id,
            cover_image_url,
            genres,
            styles,
            original_release_year
          ),
          release_tracks:release_tracks (
            recording:recordings (
              duration_seconds
            )
          )
        )
      `);

    if (error) throw error;
    if (!albums) return NextResponse.json({ success: true, stats: null });

    const albumsWithTracks = new Set<string>();
    const albumsWithMissingDurations = new Set<string>();

    // Initialize Counters
    let fullyEnriched = 0;
    let needsEnrichment = 0;
    
    // Artwork
    let missingArtwork = 0;
    let missingFrontCover = 0;
    let missingBackCover = 0;
    let missingInnerSleeve = 0;
    
    // Credits
    let missingCredits = 0;
    let missingMusicians = 0;
    let missingProducers = 0;
    let missingEngineers = 0;
    let missingSongwriters = 0;
    
    // Tracklists
    let missingTracklists = 0;
    let missingDurations = 0; // NEW STAT
    
    // Audio
    let missingAudioAnalysis = 0;
    let missingTempo = 0;
    let missingMusicalKey = 0;
    let missingDanceability = 0;
    let missingEnergy = 0;
    
    // Genres
    let missingGenres = 0;
    let missingStyles = 0;
    
    // Streaming
    let missingStreamingLinks = 0;
    let missingSpotify = 0;
    let missingAppleMusic = 0;
    let missingLastFM = 0;
    
    // Metadata
    let missingReleaseMetadata = 0;
    let missingBarcode = 0;
    let missingLabels = 0;
    let missingOriginalDate = 0;
    let missingCatalogNumber = 0;

    const folders = new Set<string>();

    albums.forEach(album => {
      const albumIdStr = String(album.id);
      const release = album.release;
      const master = release?.master;
      const releaseTracks = release?.release_tracks ?? [];

      if (releaseTracks.length > 0) {
        albumsWithTracks.add(albumIdStr);
      }

      const missingDuration = releaseTracks.some((track) => !track.recording?.duration_seconds && track.recording?.duration_seconds !== 0);
      if (missingDuration) {
        albumsWithMissingDurations.add(albumIdStr);
      }

      const hasFront = !!master?.cover_image_url;
      if (!hasFront) {
        missingArtwork++;
        missingFrontCover++;
      }

      const hasTracks = albumsWithTracks.has(albumIdStr);
      const hasMissingDurations = albumsWithMissingDurations.has(albumIdStr);
      if (!hasTracks) missingTracklists++;
      if (hasMissingDurations) missingDurations++;

      const hasGenres = Array.isArray(master?.genres) && master?.genres.length > 0;
      const hasStyles = Array.isArray(master?.styles) && master?.styles.length > 0;
      if (!hasGenres || !hasStyles) missingGenres++;
      if (!hasStyles) missingStyles++;

      const hasSpotify = !!release?.spotify_album_id;
      const hasApple = !!release?.apple_music_id;
      if (!hasSpotify || !hasApple) missingStreamingLinks++;
      if (!hasSpotify) missingSpotify++;
      if (!hasApple) missingAppleMusic++;

      const hasOriginalDate = !!master?.original_release_year || !!release?.release_year;
      const hasBarcode = !!release?.barcode;
      const hasLabel = !!release?.label;
      const hasCatalogNumber = !!release?.catalog_number;
      if (!hasOriginalDate || !hasBarcode || !hasLabel || !hasCatalogNumber) {
        missingReleaseMetadata++;
      }
      if (!hasOriginalDate) missingOriginalDate++;
      if (!hasBarcode) missingBarcode++;
      if (!hasLabel) missingLabels++;
      if (!hasCatalogNumber) missingCatalogNumber++;

      const isComplete =
        hasFront &&
        hasTracks &&
        hasGenres &&
        (hasSpotify || hasApple) &&
        (hasBarcode && hasLabel && hasOriginalDate);

      if (isComplete) fullyEnriched++;
      else needsEnrichment++;
    });

    const stats = {
      total: albums.length,
      fullyEnriched,
      needsEnrichment,
      
      missingArtwork,
      missingFrontCover,
      missingBackCover,
      missingInnerSleeve,
      
      missingCredits,
      missingMusicians,
      missingProducers,
      missingEngineers,
      missingSongwriters,
      
      missingTracklists,
      missingDurations, // Added to response
      
      missingAudioAnalysis,
      missingTempo,
      missingMusicalKey,
      missingDanceability,
      missingEnergy,
      
      missingGenres,
      missingStyles,
      
      missingStreamingLinks,
      missingSpotify,
      missingAppleMusic,
      missingLastFM,
      
      missingReleaseMetadata,
      missingBarcode,
      missingLabels,
      missingOriginalDate,
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
