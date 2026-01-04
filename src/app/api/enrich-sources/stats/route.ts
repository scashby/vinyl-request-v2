// src/app/api/enrich-sources/stats/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    // 1. Select all columns needed for the detailed stats
    const { data: albums, error } = await supabase
      .from('collection')
      .select(`
        id,
        musicbrainz_id,
        musicians,
        producers,
        spotify_id,
        apple_music_id,
        lastfm_id,
        allmusic_id,
        wikipedia_url,
        tempo_bpm,
        discogs_release_id,
        discogs_master_id,
        image_url,
        back_image_url,
        genres,
        tracklists,
        cat_no,
        barcode,
        country,
        folder,
        labels
      `);

    if (error || !albums) {
      console.error("Supabase Error:", error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch albums'
      }, { status: 500 });
    }

    // 2. Initialize stats strictly matching the 'EnrichmentStats' type in the frontend
    const stats = {
      total: albums.length,
      needsEnrichment: 0,
      fullyEnriched: 0,
      
      // Artwork
      missingArtwork: 0,
      missingBackCover: 0,
      missingSpineCover: 0,
      missingInnerSleeves: 0,
      missingLabelImages: 0,
      
      // Credits
      missingCredits: 0,
      missingMusicians: 0,
      missingProducers: 0,
      missingEngineers: 0,
      missingSongwriters: 0,
      
      // Tracklists
      missingTracklists: 0,
      
      // Audio
      missingAudioAnalysis: 0,
      missingTempo: 0,
      missingKey: 0,
      missingMoodData: 0,
      
      // Genres
      missingGenres: 0,
      
      // Streaming
      missingStreamingLinks: 0,
      missingSpotify: 0,
      missingAppleMusic: 0,
      missingLastFm: 0,
      
      // Reviews/Charts
      missingReviews: 0,
      missingRatings: 0,
      missingChartData: 0,
      
      // Metadata
      missingReleaseMetadata: 0,
      missingDiscogsIds: 0,
      missingLabels: 0,
      missingCatalogNumber: 0,
      missingBarcode: 0,
      missingCountry: 0,
    };

    // 3. Calculate stats
    albums.forEach(album => {
      // -- Check Individual Fields --
      const hasImage = !!album.image_url;
      const hasBack = !!album.back_image_url;
      const hasMusicians = album.musicians && album.musicians.length > 0;
      const hasProducers = album.producers && album.producers.length > 0;
      const hasSpotify = !!album.spotify_id;
      const hasApple = !!album.apple_music_id;
      const hasLastFm = !!album.lastfm_id;
      const hasDiscogs = !!album.discogs_release_id;
      const hasCat = !!album.cat_no;
      const hasBarcode = !!album.barcode;
      const hasCountry = !!album.country;
      const hasTempo = !!album.tempo_bpm;
      const hasGenres = album.genres && album.genres.length > 0;
      const hasTracks = !!album.tracklists;
      const hasLabels = album.labels && album.labels.length > 0;

      // -- Increment Counters --
      if (!hasImage) stats.missingArtwork++;
      if (!hasBack) stats.missingBackCover++;
      
      if (!hasMusicians) stats.missingMusicians++;
      if (!hasProducers) stats.missingProducers++;
      // Aggregate credits check
      if (!hasMusicians && !hasProducers) stats.missingCredits++;

      if (!hasTracks) stats.missingTracklists++;

      if (!hasTempo) stats.missingTempo++;
      // Aggregate audio check
      if (!hasTempo) stats.missingAudioAnalysis++; 

      if (!hasGenres) stats.missingGenres++;

      if (!hasSpotify) stats.missingSpotify++;
      if (!hasApple) stats.missingAppleMusic++;
      if (!hasLastFm) stats.missingLastFm++;
      // Aggregate streaming check (missing ALL is bad, missing ANY is also a gap)
      if (!hasSpotify || !hasApple) stats.missingStreamingLinks++;

      if (!hasDiscogs) stats.missingDiscogsIds++;
      if (!hasCat) stats.missingCatalogNumber++;
      if (!hasBarcode) stats.missingBarcode++;
      if (!hasCountry) stats.missingCountry++;
      if (!hasLabels) stats.missingLabels++;

      // Aggregate metadata check - Expanded to catch more missing data
      if (!hasDiscogs || !hasCat || !hasBarcode || !hasCountry || !hasLabels) {
        stats.missingReleaseMetadata++;
      }

      // -- Total "Health" Check --
      const isRich = hasImage && hasBack && hasMusicians && hasSpotify && hasDiscogs && hasGenres;
      if (isRich) {
        stats.fullyEnriched++;
      } else {
        stats.needsEnrichment++;
      }
    });

    const folders = Array.from(new Set(albums.map(a => a.folder).filter(Boolean)));

    return NextResponse.json({
      success: true,
      stats,
      folders
    });

  } catch (error) {
    console.error("Stats Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}