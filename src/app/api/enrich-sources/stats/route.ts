// src/app/api/enrich-sources/stats/route.ts
/**
 * COMPLETE ENRICHMENT STATS ENDPOINT
 * Checks ACTUAL DATABASE FIELDS not service presence
 * 
 * Example: Counts albums missing musicians/producers (actual data)
 *          NOT albums missing musicbrainz_id (service link)
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    // Fetch all albums with all enrichment fields
    const { data: albums, error } = await supabase
      .from('collection')
      .select('*');

    if (error || !albums) {
      console.error('Failed to fetch albums:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch albums'
      }, { status: 500 });
    }

    // Initialize stats counters
    const stats = {
      artwork: 0,
      credits: 0,
      tracklists: 0,
      audio_analysis: 0,
      genres: 0,
      streaming_links: 0,
      reviews: 0,
      chart_data: 0,
      release_metadata: 0,
      lyrics: 0,
      similar_albums: 0,
      cultural_context: 0,
    };

    // Check each album for missing data
    albums.forEach(album => {
      // ARTWORK - Check canonical image fields
      const hasImageUrl = Boolean(album.image_url);
      const hasBackImage = Boolean(album.back_image_url);
      const hasSpineImage = Boolean(album.spine_image_url);
      const hasInnerSleeves = Array.isArray(album.inner_sleeve_images) && album.inner_sleeve_images.length > 0;
      const hasVinylLabels = Array.isArray(album.vinyl_label_images) && album.vinyl_label_images.length > 0;
      
      const hasArtwork = hasImageUrl || hasBackImage || hasSpineImage || hasInnerSleeves || hasVinylLabels;
      if (!hasArtwork) stats.artwork++;

      // CREDITS - Check canonical credit fields
      const hasMusicians = Array.isArray(album.musicians) && album.musicians.length > 0;
      const hasProducers = Array.isArray(album.producers) && album.producers.length > 0;
      const hasEngineers = Array.isArray(album.engineers) && album.engineers.length > 0;
      const hasSongwriters = Array.isArray(album.songwriters) && album.songwriters.length > 0;
      const hasComposer = Boolean(album.composer);
      const hasConductor = Boolean(album.conductor);
      const hasOrchestra = Boolean(album.orchestra);
      const hasChorus = Boolean(album.chorus);
      
      const hasCredits = hasMusicians || hasProducers || hasEngineers || hasSongwriters || 
                         hasComposer || hasConductor || hasOrchestra || hasChorus;
      if (!hasCredits) stats.credits++;

      // TRACKLISTS - Check tracks or tracklists fields
      const hasTracks = Boolean(album.tracks);
      const hasTracklists = Boolean(album.tracklists);
      const hasDiscMetadata = Array.isArray(album.disc_metadata) && album.disc_metadata.length > 0;
      
      const hasTrackData = hasTracks || hasTracklists || hasDiscMetadata;
      if (!hasTrackData) stats.tracklists++;

      // AUDIO ANALYSIS - Check tempo, key, danceability, energy, moods
      const hasTempo = Boolean(album.tempo_bpm);
      const hasMusicalKey = Boolean(album.musical_key);
      const hasTimeSignature = Boolean(album.time_signature);
      const hasDanceability = Boolean(album.danceability);
      const hasEnergy = Boolean(album.energy);
      const hasMoodAcoustic = Boolean(album.mood_acoustic);
      const hasMoodHappy = Boolean(album.mood_happy);
      const hasMoodSad = Boolean(album.mood_sad);
      
      const hasAudioAnalysis = hasTempo || hasMusicalKey || hasTimeSignature || hasDanceability || 
                               hasEnergy || hasMoodAcoustic || hasMoodHappy || hasMoodSad;
      if (!hasAudioAnalysis) stats.audio_analysis++;

      // GENRES - Check any genre/style fields from any service
      const hasDiscogsGenres = Array.isArray(album.discogs_genres) && album.discogs_genres.length > 0;
      const hasSpotifyGenres = Array.isArray(album.spotify_genres) && album.spotify_genres.length > 0;
      const hasAppleGenres = Array.isArray(album.apple_music_genres) && album.apple_music_genres.length > 0;
      const hasLastfmTags = Boolean(album.lastfm_tags);
      const hasAllmusicStyles = Array.isArray(album.allmusic_styles) && album.allmusic_styles.length > 0;
      
      const hasGenres = hasDiscogsGenres || hasSpotifyGenres || hasAppleGenres || hasLastfmTags || hasAllmusicStyles;
      if (!hasGenres) stats.genres++;

      // STREAMING LINKS - Check service IDs (these ARE service presence checks)
      const hasSpotifyId = Boolean(album.spotify_id);
      const hasAppleMusicId = Boolean(album.apple_music_id);
      const hasLastfmId = Boolean(album.lastfm_id);
      const hasMusicBrainzId = Boolean(album.musicbrainz_id);
      const hasAllmusicId = Boolean(album.allmusic_id);
      const hasWikipediaUrl = Boolean(album.wikipedia_url);
      
      const hasStreamingLinks = hasSpotifyId || hasAppleMusicId || hasLastfmId || 
                                hasMusicBrainzId || hasAllmusicId || hasWikipediaUrl;
      if (!hasStreamingLinks) stats.streaming_links++;

      // REVIEWS - Check ratings, reviews, playcounts, popularity
      const hasAllmusicRating = Boolean(album.allmusic_rating);
      const hasAllmusicReview = Boolean(album.allmusic_review);
      const hasLastfmPlaycount = Boolean(album.lastfm_playcount);
      const hasLastfmListeners = Boolean(album.lastfm_listeners);
      const hasSpotifyPopularity = Boolean(album.spotify_popularity);
      const hasCriticalReception = Boolean(album.critical_reception);
      const hasEditorialNotes = Boolean(album.apple_music_editorial_notes);
      
      const hasReviews = hasAllmusicRating || hasAllmusicReview || hasLastfmPlaycount || 
                        hasLastfmListeners || hasSpotifyPopularity || hasCriticalReception || hasEditorialNotes;
      if (!hasReviews) stats.reviews++;

      // CHART DATA - Check chart positions, certifications, awards
      const hasChartPositions = Boolean(album.chart_positions);
      const hasCertifications = Boolean(album.certifications);
      const hasAwards = Boolean(album.awards);
      
      const hasChartData = hasChartPositions || hasCertifications || hasAwards;
      if (!hasChartData) stats.chart_data++;

      // RELEASE METADATA - Check labels, catalog, barcode, country, dates
      const hasLabels = Array.isArray(album.labels) && album.labels.length > 0;
      const hasCatNo = Boolean(album.cat_no);
      const hasBarcode = Boolean(album.barcode);
      const hasCountry = Boolean(album.country);
      const hasRecordingDate = Boolean(album.recording_date);
      const hasOriginalReleaseDate = Boolean(album.original_release_date);
      const hasStudio = Boolean(album.studio);
      const hasRecordingLocation = Boolean(album.recording_location);
      
      const hasReleaseMetadata = hasLabels || hasCatNo || hasBarcode || hasCountry || 
                                 hasRecordingDate || hasOriginalReleaseDate || hasStudio || hasRecordingLocation;
      if (!hasReleaseMetadata) stats.release_metadata++;

      // LYRICS - Check if tracks have lyrics (track-level check)
      let hasLyrics = false;
      if (album.tracks && Array.isArray(album.tracks)) {
        hasLyrics = album.tracks.some((track: { lyrics?: string; lyrics_url?: string }) => 
          Boolean(track.lyrics) || Boolean(track.lyrics_url)
        );
      }
      if (!hasLyrics) stats.lyrics++;

      // SIMILAR ALBUMS - Check similar album recommendations
      const hasLastfmSimilar = Boolean(album.lastfm_similar_albums);
      const hasAllmusicSimilar = Boolean(album.allmusic_similar_albums);
      
      const hasSimilarAlbums = hasLastfmSimilar || hasAllmusicSimilar;
      if (!hasSimilarAlbums) stats.similar_albums++;

      // CULTURAL CONTEXT - Check Wikipedia/cultural data
      const hasCulturalSignificance = Boolean(album.cultural_significance);
      const hasRecordingLocationContext = Boolean(album.recording_location);
      const hasCriticalReceptionContext = Boolean(album.critical_reception);
      
      const hasCulturalContext = hasCulturalSignificance || hasRecordingLocationContext || hasCriticalReceptionContext;
      if (!hasCulturalContext) stats.cultural_context++;
    });

    return NextResponse.json({
      success: true,
      total: albums.length,
      stats
    });

  } catch (error) {
    console.error('Stats endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}