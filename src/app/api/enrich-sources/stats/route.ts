import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));

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
          master:masters (
            id,
            cover_image_url,
            genres,
            styles,
            original_release_year
          ),
          release_tracks:release_tracks (
            recording:recordings (
              duration_seconds,
              credits
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
    const missingLastFM = 0;
    
    // Metadata
    let missingReleaseMetadata = 0;
    let missingBarcode = 0;
    let missingLabels = 0;
    let missingOriginalDate = 0;
    let missingCatalogNumber = 0;

    const folders = new Set<string>();

    const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
      Array.isArray(value) ? value[0] ?? null : value ?? null;

    const asRecord = (value: unknown): Record<string, unknown> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return value as Record<string, unknown>;
    };

    const asStringArray = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
      }
      if (typeof value === 'string') return [value];
      return [];
    };

    const getAlbumCredits = (credits: unknown) => {
      const record = asRecord(credits);
      const albumPeople = asRecord(record.album_people ?? record.albumPeople);
      const classical = asRecord(record.classical);
      const artwork = asRecord(record.artwork ?? record.album_artwork ?? record.albumArtwork);
      const albumDetails = asRecord(record.album_details ?? record.albumDetails ?? record.album_metadata);
      const links = asRecord(albumDetails.links ?? albumDetails.link ?? {});
      return { albumPeople, classical, artwork, albumDetails, links };
    };

    albums.forEach(album => {
      const albumIdStr = String(album.id);
      const release = toSingle(album.release);
      const master = toSingle(release?.master);
      const releaseTracks = release?.release_tracks ?? [];
      const firstRecording = toSingle(releaseTracks[0]?.recording);
      const creditInfo = getAlbumCredits(firstRecording?.credits);

      if (releaseTracks.length > 0) {
        albumsWithTracks.add(albumIdStr);
      }

      const missingDuration = releaseTracks.some((track) => {
        const recording = toSingle(track.recording);
        return !recording?.duration_seconds && recording?.duration_seconds !== 0;
      });
      if (missingDuration) {
        albumsWithMissingDurations.add(albumIdStr);
      }

      const hasFront = !!master?.cover_image_url;
      if (!hasFront) {
        missingArtwork++;
        missingFrontCover++;
      }

      const hasBack = !!creditInfo.artwork.back_image_url;
      const hasInnerSleeve = asStringArray(creditInfo.artwork.inner_sleeve_images).length > 0;
      if (!hasBack) missingBackCover++;
      if (!hasInnerSleeve) missingInnerSleeve++;

      const musicians = asStringArray(creditInfo.albumPeople.musicians);
      const producers = asStringArray(creditInfo.albumPeople.producers);
      const engineers = asStringArray(creditInfo.albumPeople.engineers);
      const songwriters = asStringArray(creditInfo.albumPeople.songwriters);
      const hasCredits = musicians.length > 0 || producers.length > 0 || engineers.length > 0 || songwriters.length > 0;
      if (!hasCredits) missingCredits++;
      if (musicians.length === 0) missingMusicians++;
      if (producers.length === 0) missingProducers++;
      if (engineers.length === 0) missingEngineers++;
      if (songwriters.length === 0) missingSongwriters++;

      const tempo = creditInfo.albumDetails.tempo_bpm ?? null;
      const musicalKey = creditInfo.albumDetails.musical_key ?? null;
      const energy = creditInfo.albumDetails.energy ?? null;
      const danceability = creditInfo.albumDetails.danceability ?? null;
      const hasAudio = tempo || musicalKey || energy || danceability;
      if (!hasAudio) missingAudioAnalysis++;
      if (!tempo) missingTempo++;
      if (!musicalKey) missingMusicalKey++;
      if (!danceability) missingDanceability++;
      if (!energy) missingEnergy++;

      const hasTracks = albumsWithTracks.has(albumIdStr);
      const hasMissingDurations = albumsWithMissingDurations.has(albumIdStr);
      if (!hasTracks) missingTracklists++;
      if (hasMissingDurations) missingDurations++;

      const hasGenres = Array.isArray(master?.genres) && master?.genres.length > 0;
      const hasStyles = Array.isArray(master?.styles) && master?.styles.length > 0;
      if (!hasGenres || !hasStyles) missingGenres++;
      if (!hasStyles) missingStyles++;

      const hasSpotify = !!release?.spotify_album_id;
      const hasApple = !!(creditInfo.links.apple_music_url ?? creditInfo.albumDetails.apple_music_url);
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
