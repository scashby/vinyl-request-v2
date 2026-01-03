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
    const { data: albums } = await supabase
      .from('collection')
      .select('id,musicbrainz_id,musicians,producers,spotify_id,apple_music_id,lastfm_id,allmusic_id,wikipedia_url,tempo_bpm,discogs_release_id,discogs_master_id,image_url,back_image_url,discogs_genres,tracklists,folder');

    if (!albums) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch albums'
      }, { status: 500 });
    }

    const stats = {
      total: albums.length,
      needsEnrichment: 0,
      fullyEnriched: 0,
      missingDiscogsId: 0,
      missingMasterId: 0,
      missingImage: 0,
      missingBackImage: 0,
      missingGenres: 0,
      missingTracklists: 0,
      missingMusicians: 0,
      missingProducers: 0,
      missingSpotify: 0,
      missingApple: 0,
      missingLastFm: 0,
      missingAllMusic: 0,
      missingWikipedia: 0,
      missingTempo: 0,
      missingAudioFeatures: 0,
    };

    albums.forEach(album => {
      const hasMusicBrainz = album.musicbrainz_id && album.musicians?.length > 0 && album.producers?.length > 0;
      const hasDiscogs = album.discogs_release_id && album.discogs_master_id && album.discogs_genres?.length > 0;
      const hasImages = album.image_url && album.back_image_url;
      const hasStreaming = album.spotify_id && album.apple_music_id;
      const hasMetadata = album.lastfm_id && album.allmusic_id && album.wikipedia_url;
      const hasAudio = album.tempo_bpm;

      if (hasMusicBrainz && hasDiscogs && hasImages && hasStreaming && hasMetadata && hasAudio) {
        stats.fullyEnriched++;
      } else {
        stats.needsEnrichment++;
      }

      if (!album.discogs_release_id) stats.missingDiscogsId++;
      if (!album.discogs_master_id) stats.missingMasterId++;
      if (!album.image_url) stats.missingImage++;
      if (!album.back_image_url) stats.missingBackImage++;
      if (!album.discogs_genres || album.discogs_genres.length === 0) stats.missingGenres++;
      if (!album.tracklists) stats.missingTracklists++;
      if (!album.musicians || album.musicians.length === 0) stats.missingMusicians++;
      if (!album.producers || album.producers.length === 0) stats.missingProducers++;
      if (!album.spotify_id) stats.missingSpotify++;
      if (!album.apple_music_id) stats.missingApple++;
      if (!album.lastfm_id) stats.missingLastFm++;
      if (!album.allmusic_id) stats.missingAllMusic++;
      if (!album.wikipedia_url) stats.missingWikipedia++;
      if (!album.tempo_bpm) stats.missingTempo++;
    });

    const folders = Array.from(new Set(albums.map(a => a.folder).filter(Boolean)));

    return NextResponse.json({
      success: true,
      stats,
      folders
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}