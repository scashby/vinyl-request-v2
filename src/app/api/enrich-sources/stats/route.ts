import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { DATA_CATEGORY_CHECK_FIELDS } from "src/lib/enrichment-data-mapping";

export const dynamic = 'force-dynamic';

const NON_ENRICHABLE_FIELDS = new Set<string>([
  'samples',
  'sampled_by',
]);

type RecordingRow = {
  duration_seconds: number | null;
  credits: unknown;
  lyrics: string | null;
  lyrics_url: string | null;
};

type ReleaseTrackRow = {
  recording?: RecordingRow | RecordingRow[] | null;
};

type MasterRow = {
  id?: number | string | null;
  cover_image_url?: string | null;
  genres?: string[] | null;
  styles?: string[] | null;
  discogs_master_id?: string | null;
  musicbrainz_release_group_id?: string | null;
  original_release_year?: number | null;
  master_release_date?: string | null;
  recording_date?: string | null;
  musicians?: string[] | null;
  producers?: string[] | null;
  engineers?: string[] | null;
  songwriters?: string[] | null;
  critical_reception?: string | null;
  pitchfork_score?: number | string | null;
  chart_positions?: string[] | null;
  certifications?: string[] | null;
  awards?: string[] | null;
  cultural_significance?: string | null;
  recording_location?: string | null;
  notes?: string | null;
  wikipedia_url?: string | null;
  apple_music_url?: string | null;
  lastfm_url?: string | null;
  lastfm_similar_albums?: string[] | null;
  master_tag_links?: { tag?: { name?: string | null } | null }[] | null;
};

type ReleaseRow = {
  id?: number | string | null;
  barcode?: string | null;
  label?: string | null;
  catalog_number?: string | null;
  country?: string | null;
  notes?: string | null;
  studio?: string | null;
  disc_metadata?: unknown;
  release_date?: string | null;
  release_year?: number | null;
  discogs_release_id?: string | null;
  spotify_album_id?: string | null;
  master?: MasterRow | MasterRow[] | null;
  release_tracks?: ReleaseTrackRow[] | null;
};

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request));

  try {
    // 1. Fetch Albums (paginate to avoid Supabase 1000-row default cap)
    const albums: Array<{
      id: string | number;
      release?: ReleaseRow | ReleaseRow[] | null;
    }> = [];
    const batchSize = 1000;
    let from = 0;
    let done = false;

    while (!done) {
      const { data: batch, error } = await supabase
        .from('inventory')
        .select(`
          id,
          release:releases (
            id,
            barcode,
            label,
            catalog_number,
            country,
            notes,
            studio,
            disc_metadata,
            release_date,
            release_year,
            discogs_release_id,
            spotify_album_id,
            master:masters (
              id,
              cover_image_url,
              genres,
              styles,
              discogs_master_id,
              musicbrainz_release_group_id,
              original_release_year,
              master_release_date,
              recording_date,
              musicians,
              producers,
              engineers,
              songwriters,
              critical_reception,
              pitchfork_score,
              chart_positions,
              certifications,
              awards,
              cultural_significance,
              recording_location,
              notes,
              wikipedia_url,
              apple_music_url,
              lastfm_url,
              lastfm_similar_albums,
              master_tag_links:master_tag_links (
                tag:master_tags ( name )
              )
            ),
            release_tracks:release_tracks (
              recording:recordings (
                duration_seconds,
                credits,
                lyrics,
                lyrics_url
              )
            )
          )
        `)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!batch || batch.length === 0) break;

      albums.push(...batch);
      if (batch.length < batchSize) {
        done = true;
      } else {
        from += batchSize;
      }
    }

    if (albums.length === 0) return NextResponse.json({ success: true, stats: null });

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
    let missingSpine = 0;
    let missingVinylLabel = 0;
    
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
    let missingLyrics = 0;
    let missingReviews = 0;
    let missingChartData = 0;
    let missingContext = 0;
    let missingSimilar = 0;

    const folders = new Set<string>();
    const allCheckFields = Array.from(
      new Set(Object.values(DATA_CATEGORY_CHECK_FIELDS).flat())
    );
    const fieldMissing: Record<string, number> = Object.fromEntries(
      allCheckFields.map((field) => [field, 0])
    );
    const fieldApplicable: Record<string, number> = Object.fromEntries(
      allCheckFields.map((field) => [field, 0])
    );

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

    const hasString = (value: unknown): boolean =>
      typeof value === 'string' && value.trim().length > 0;

    const hasArray = (value: unknown): boolean =>
      Array.isArray(value) && value.some((item) => {
        if (typeof item === 'string') return item.trim().length > 0;
        return item !== null && item !== undefined;
      });

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
      const release = toSingle<ReleaseRow>(album.release);
      const master = toSingle<MasterRow>(release?.master ?? null);
      const releaseTracks = release?.release_tracks ?? [];
      const recordings = releaseTracks
        .map((track) => toSingle<RecordingRow>(track.recording))
        .filter((recording): recording is RecordingRow => !!recording);
      const firstRecording = toSingle<RecordingRow>(releaseTracks[0]?.recording ?? null);
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
      const hasSpine = !!creditInfo.artwork.spine_image_url;
      const hasVinylLabel = asStringArray(creditInfo.artwork.vinyl_label_images).length > 0;
      if (!hasBack) missingBackCover++;
      if (!hasInnerSleeve) missingInnerSleeve++;
      if (!hasSpine) missingSpine++;
      if (!hasVinylLabel) missingVinylLabel++;

      const musicians = [
        ...asStringArray(master?.musicians),
        ...asStringArray(creditInfo.albumPeople.musicians)
      ];
      const producers = [
        ...asStringArray(master?.producers),
        ...asStringArray(creditInfo.albumPeople.producers)
      ];
      const engineers = [
        ...asStringArray(master?.engineers),
        ...asStringArray(creditInfo.albumPeople.engineers)
      ];
      const songwriters = [
        ...asStringArray(master?.songwriters),
        ...asStringArray(creditInfo.albumPeople.songwriters)
      ];
      const hasCredits = musicians.length > 0 || producers.length > 0 || engineers.length > 0 || songwriters.length > 0;
      if (!hasCredits) missingCredits++;
      if (musicians.length === 0) missingMusicians++;
      if (producers.length === 0) missingProducers++;
      if (engineers.length === 0) missingEngineers++;
      if (songwriters.length === 0) missingSongwriters++;

      const tempo = creditInfo.albumDetails.tempo_bpm ?? null;
      const musicalKey = creditInfo.albumDetails.musical_key ?? null;
      const timeSignature = creditInfo.albumDetails.time_signature ?? null;
      const energy = creditInfo.albumDetails.energy ?? null;
      const danceability = creditInfo.albumDetails.danceability ?? null;
      const hasAudio = tempo || musicalKey || timeSignature || energy || danceability;
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
      const hasApple = !!(
        master?.apple_music_url ??
        creditInfo.links.apple_music_url ??
        creditInfo.albumDetails.apple_music_url ??
        creditInfo.albumDetails.apple_music_id
      );
      if (!hasSpotify || !hasApple) missingStreamingLinks++;
      if (!hasSpotify) missingSpotify++;
      if (!hasApple) missingAppleMusic++;

      const hasOriginalDate = !!master?.master_release_date;
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

      const hasLyrics = releaseTracks.some((track) => {
        const recording = toSingle(track.recording);
        const credits = asRecord(recording?.credits);
        return hasString(recording?.lyrics_url)
          || hasString(credits.lyrics_url)
          || hasString(recording?.lyrics)
          || hasString(credits.lyrics);
      });
      if (!hasLyrics) missingLyrics++;

      const hasReviews =
        hasString(master?.critical_reception)
        || master?.pitchfork_score !== null && master?.pitchfork_score !== undefined
        || hasString(creditInfo.albumDetails.critical_reception)
        || hasString(creditInfo.albumDetails.apple_music_editorial_notes)
        || hasString(creditInfo.albumDetails.pitchfork_score);
      if (!hasReviews) missingReviews++;

      const hasChartData =
        hasArray(master?.chart_positions)
        || hasArray(master?.certifications)
        || hasArray(master?.awards)
        || hasArray(creditInfo.albumDetails.chart_positions)
        || hasArray(creditInfo.albumDetails.certifications)
        || hasArray(creditInfo.albumDetails.awards);
      if (!hasChartData) missingChartData++;

      const hasContext =
        hasString(master?.cultural_significance)
        || hasString(master?.recording_location)
        || hasString(master?.critical_reception)
        || hasString(master?.notes)
        || hasString(master?.wikipedia_url)
        || hasString(creditInfo.albumDetails.cultural_significance)
        || hasString(creditInfo.albumDetails.recording_location)
        || hasString(creditInfo.albumDetails.critical_reception)
        || hasString(creditInfo.links.wikipedia_url);
      if (!hasContext) missingContext++;

      const hasSimilarAlbums =
        hasArray(master?.lastfm_similar_albums)
        || hasArray(creditInfo.albumDetails.lastfm_similar_albums);
      if (!hasSimilarAlbums) missingSimilar++;

      const hasTrackLyrics = recordings.some((recording) => {
        const credits = asRecord(recording.credits);
        return hasString(recording.lyrics) || hasString(credits.lyrics);
      });
      const hasTrackLyricsUrl = recordings.some((recording) => {
        const credits = asRecord(recording.credits);
        return hasString(recording.lyrics_url) || hasString(credits.lyrics_url);
      });
      const hasTags =
        hasArray(master?.master_tag_links)
        || hasArray(creditInfo.albumDetails.tags)
        || hasArray(creditInfo.albumDetails.lastfm_tags);
      const hasPitchforkScore =
        master?.pitchfork_score !== null && master?.pitchfork_score !== undefined
        || creditInfo.albumDetails.pitchfork_score !== null && creditInfo.albumDetails.pitchfork_score !== undefined;
      const hasMasterNotes = hasString(master?.notes) || hasString(creditInfo.albumDetails.master_notes);

      const hasFieldValue = (field: string): boolean => {
        switch (field) {
          case 'image_url': return hasFront;
          case 'back_image_url': return hasBack;
          case 'spine_image_url': return hasSpine;
          case 'inner_sleeve_images': return hasInnerSleeve;
          case 'vinyl_label_images': return hasVinylLabel;
          case 'musicians': return musicians.length > 0;
          case 'producers': return producers.length > 0;
          case 'engineers': return engineers.length > 0;
          case 'songwriters': return songwriters.length > 0;
          case 'tracks':
          case 'tracklists':
          case 'tracklist':
            return hasTracks;
          case 'disc_metadata':
            return hasArray(release?.disc_metadata);
          case 'tempo_bpm':
            return tempo !== null && tempo !== undefined && `${tempo}`.trim().length > 0;
          case 'musical_key':
            return musicalKey !== null && musicalKey !== undefined && `${musicalKey}`.trim().length > 0;
          case 'time_signature':
            return creditInfo.albumDetails.time_signature !== null && creditInfo.albumDetails.time_signature !== undefined
              && `${creditInfo.albumDetails.time_signature}`.trim().length > 0;
          case 'danceability':
            return danceability !== null && danceability !== undefined;
          case 'energy':
            return energy !== null && energy !== undefined;
          case 'mood_acoustic':
          case 'mood_happy':
          case 'mood_sad':
          case 'mood_party':
          case 'mood_relaxed':
          case 'mood_aggressive':
          case 'mood_electronic':
            return creditInfo.albumDetails[field] !== null && creditInfo.albumDetails[field] !== undefined;
          case 'is_cover':
            return creditInfo.albumDetails.is_cover !== null && creditInfo.albumDetails.is_cover !== undefined;
          case 'original_artist':
            return hasString(creditInfo.albumDetails.original_artist);
          case 'original_year':
            return creditInfo.albumDetails.original_year !== null && creditInfo.albumDetails.original_year !== undefined;
          case 'samples':
          case 'sampled_by':
            return hasArray(creditInfo.albumDetails[field]);
          case 'genres':
            return hasGenres;
          case 'styles':
            return hasStyles;
          case 'tags':
            return hasTags;
          case 'spotify_id':
            return hasSpotify;
          case 'apple_music_id':
            return hasApple;
          case 'lastfm_id':
            return hasString(master?.lastfm_url)
              || hasString(creditInfo.albumDetails.lastfm_id)
              || hasString(creditInfo.albumDetails.lastfm_url);
          case 'musicbrainz_id':
            return hasString(master?.musicbrainz_release_group_id);
          case 'wikipedia_url':
            return hasString(master?.wikipedia_url) || hasString(creditInfo.links.wikipedia_url);
          case 'discogs_release_id':
            return hasString(release?.discogs_release_id);
          case 'discogs_master_id':
            return hasString(master?.discogs_master_id);
          case 'critical_reception':
            return hasString(master?.critical_reception) || hasString(creditInfo.albumDetails.critical_reception);
          case 'apple_music_editorial_notes':
            return hasString(creditInfo.albumDetails.apple_music_editorial_notes);
          case 'pitchfork_score':
            return hasPitchforkScore;
          case 'chart_positions':
            return hasArray(master?.chart_positions) || hasArray(creditInfo.albumDetails.chart_positions);
          case 'certifications':
            return hasArray(master?.certifications) || hasArray(creditInfo.albumDetails.certifications);
          case 'awards':
            return hasArray(master?.awards) || hasArray(creditInfo.albumDetails.awards);
          case 'labels':
            return hasLabel;
          case 'cat_no':
            return hasCatalogNumber;
          case 'barcode':
            return hasBarcode;
          case 'country':
            return hasString(release?.country);
          case 'recording_date':
            return hasString(master?.recording_date);
          case 'original_release_date':
            return hasOriginalDate;
          case 'studio':
            return hasString(release?.studio);
          case 'companies':
            return hasArray(creditInfo.albumDetails.companies);
          case 'release_notes':
            return hasString(release?.notes);
          case 'tracks.lyrics_url':
            return hasTrackLyricsUrl;
          case 'tracks.lyrics':
            return hasTrackLyrics;
          case 'lastfm_similar_albums':
            return hasArray(master?.lastfm_similar_albums) || hasArray(creditInfo.albumDetails.lastfm_similar_albums);
          case 'cultural_significance':
            return hasString(master?.cultural_significance) || hasString(creditInfo.albumDetails.cultural_significance);
          case 'recording_location':
            return hasString(master?.recording_location) || hasString(creditInfo.albumDetails.recording_location);
          case 'master_notes':
            return hasMasterNotes;
          default:
            return false;
        }
      };

      for (const field of allCheckFields) {
        if (NON_ENRICHABLE_FIELDS.has(field)) continue;
        fieldApplicable[field] += 1;
        if (!hasFieldValue(field)) {
          fieldMissing[field] += 1;
        }
      }

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
      missingSpine,
      missingVinylLabel,
      
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
      missingCatalogNumber,
      missingLyrics,
      missingReviews,
      missingChartData,
      missingContext,
      missingSimilar,
      fieldMissing,
      fieldApplicable
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
// AUDIT: updated for V3 alignment, UI parity, and build stability.
