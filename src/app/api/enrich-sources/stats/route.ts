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
    // 1. Fetch Albums with all relevant columns
    const { data: albums, error } = await supabase
      .from('collection')
      .select(`
        id, location,
        image_url, back_image_url, inner_sleeve_images,
        musicians, producers, engineers, songwriters,
        tempo_bpm, musical_key, danceability, energy,
        genres, styles,
        spotify_id, apple_music_id, lastfm_url,
        barcode, labels, original_release_date, cat_no
      `);

    if (error) throw error;
    if (!albums) return NextResponse.json({ success: true, stats: null });

    // 2. Fetch Track Data (Source of Truth)
    // UPGRADE: Fetch duration to check for missing times
    const { data: trackRows, error: trackError } = await supabase
      .from('tracks')
      .select('album_id, duration');
    
    if (trackError) console.error("Track Fetch Error:", trackError);

    // Analyze Track Data
    const albumsWithTracks = new Set<string>();
    const albumsWithMissingDurations = new Set<string>();

    trackRows?.forEach(t => {
      const aId = String(t.album_id);
      albumsWithTracks.add(aId);
      // If duration is missing/empty, flag this album
      if (!t.duration || t.duration.trim() === '') {
        albumsWithMissingDurations.add(aId);
      }
    });

    // Initialize Counters
    let fullyEnriched = 0;
    let needsEnrichment = 0;
    
    // Artwork
    let missingArtwork = 0;
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

    const locations = new Set<string>();

    albums.forEach(album => {
      if (album.location) locations.add(album.location);
      const albumIdStr = String(album.id);

      // 1. ARTWORK
      const hasFront = !!album.image_url;
      const hasBack = !!album.back_image_url;
      const hasInner = Array.isArray(album.inner_sleeve_images) && album.inner_sleeve_images.length > 0;

      if (!hasFront || !hasBack) {
        missingArtwork++; 
        if (!hasBack) missingBackCover++;
      }
      if (!hasInner) missingInnerSleeve++;

      // 2. CREDITS
      const hasMusicians = Array.isArray(album.musicians) && album.musicians.length > 0;
      const hasProducers = Array.isArray(album.producers) && album.producers.length > 0;
      const hasEngineers = Array.isArray(album.engineers) && album.engineers.length > 0;
      const hasSongwriters = Array.isArray(album.songwriters) && album.songwriters.length > 0;

      if (!hasMusicians || !hasProducers) {
        missingCredits++;
      }
      if (!hasMusicians) missingMusicians++;
      if (!hasProducers) missingProducers++;
      if (!hasEngineers) missingEngineers++;
      if (!hasSongwriters) missingSongwriters++;

      // 3. TRACKLISTS & DURATIONS
      const hasTracks = albumsWithTracks.has(albumIdStr);
      // It has missing durations if it has tracks AND is in the missing set
      const hasMissingDurations = hasTracks && albumsWithMissingDurations.has(albumIdStr);

      if (!hasTracks) {
        missingTracklists++;
      }
      if (hasMissingDurations) {
        missingDurations++;
      }

      // 4. AUDIO ANALYSIS
      const hasTempo = album.tempo_bpm !== null && album.tempo_bpm !== 0;
      const hasKey = !!album.musical_key;
      const hasDance = album.danceability !== null;
      const hasEnergy = album.energy !== null;

      if (!hasTempo || !hasKey) {
        missingAudioAnalysis++;
      }
      if (!hasTempo) missingTempo++;
      if (!hasKey) missingMusicalKey++;
      if (!hasDance) missingDanceability++;
      if (!hasEnergy) missingEnergy++;

      // 5. GENRES
      const hasGenres = Array.isArray(album.genres) && album.genres.length > 0;
      const hasStyles = Array.isArray(album.styles) && album.styles.length > 0;
      if (!hasGenres || !hasStyles) {
        missingGenres++; 
      }
      // Note: We don't increment a global "missingGenres" for styles alone, 
      // but we track the specific sub-stat
      if (!hasStyles) missingStyles++;

      // 6. STREAMING
      const hasSpotify = !!album.spotify_id;
      const hasApple = !!album.apple_music_id;
      const hasLastfm = !!album.lastfm_url;
      
      if (!hasSpotify && !hasApple && !hasLastfm) {
        missingStreamingLinks++;
      }
      if (!hasSpotify) missingSpotify++;
      if (!hasApple) missingAppleMusic++;
      if (!hasLastfm) missingLastFM++;

      // 7. RELEASE METADATA
      const hasBarcode = !!album.barcode;
      const hasLabel = Array.isArray(album.labels) && album.labels.length > 0;
      const hasOriginalDate = !!album.original_release_date;
      const hasCatNo = !!album.cat_no;
      
      if (!hasBarcode || !hasLabel || !hasOriginalDate) {
        missingReleaseMetadata++;
      }
      if (!hasBarcode) missingBarcode++;
      if (!hasLabel) missingLabels++;
      if (!hasOriginalDate) missingOriginalDate++;
      if (!hasCatNo) missingCatalogNumber++;

      // 8. TOTAL SCORE
      const isComplete = 
        (hasFront && hasBack) &&
        (hasMusicians && hasProducers) &&
        hasTracks &&
        (hasTempo && hasKey) &&
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
      locations: Array.from(locations).sort()
    });

  } catch (error) {
    console.error("Stats Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
