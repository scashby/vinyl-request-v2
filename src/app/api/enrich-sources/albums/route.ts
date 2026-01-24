// src/app/api/enrich-sources/albums/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '200');

    if (!category) {
      return NextResponse.json({
        success: false,
        error: 'category parameter required'
      }, { status: 400 });
    }

    let query = supabase
      .from('collection')
      .select('id,artist,title,image_url,musicbrainz_id,musicians,producers,spotify_id,apple_music_id,lastfm_id,allmusic_id,wikipedia_url,tempo_bpm,discogs_release_id,discogs_master_id,discogs_genres,back_image_url,tracks')
      .limit(limit);

    // Apply filters based on category
    switch (category) {
      case 'needs-enrichment':
        // Albums missing any enrichment data
        break; // Return all, filter in code below
      
      case 'fully-enriched':
        // Albums with all enrichment data
        break; // Filter in code below
      
      case 'missing-musicians':
        query = query.or('musicians.is.null,musicians.eq.[]');
        break;
      
      case 'missing-producers':
        query = query.or('producers.is.null,producers.eq.[]');
        break;
      
      case 'missing-spotify':
        query = query.is('spotify_id', null);
        break;
      
      case 'missing-apple':
        query = query.is('apple_music_id', null);
        break;
      
      case 'missing-lastfm':
        query = query.is('lastfm_id', null);
        break;
      
      case 'missing-allmusic':
        query = query.is('allmusic_id', null);
        break;
      
      case 'missing-wikipedia':
        query = query.is('wikipedia_url', null);
        break;
      
      case 'missing-tempo':
        query = query.is('tempo_bpm', null);
        break;
      
      case 'missing-back-image':
        query = query.is('back_image_url', null);
        break;
      
      case 'missing-genres':
        query = query.or('discogs_genres.is.null,discogs_genres.eq.[]');
        break;
    }

    const { data: albums, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    let filteredAlbums = albums || [];

    // Post-filter for complex categories
    if (category === 'needs-enrichment') {
      filteredAlbums = filteredAlbums.filter(album => {
        const hasMusicBrainz = album.musicbrainz_id && album.musicians?.length > 0 && album.producers?.length > 0;
        const hasDiscogs = album.discogs_release_id && album.discogs_master_id && album.discogs_genres?.length > 0;
        const hasImages = album.image_url && album.back_image_url;
        const hasStreaming = album.spotify_id && album.apple_music_id;
        const hasMetadata = album.lastfm_id && album.allmusic_id && album.wikipedia_url;
        const hasAudio = album.tempo_bpm;
        return !(hasMusicBrainz && hasDiscogs && hasImages && hasStreaming && hasMetadata && hasAudio);
      });
    } else if (category === 'fully-enriched') {
      filteredAlbums = filteredAlbums.filter(album => {
        const hasMusicBrainz = album.musicbrainz_id && album.musicians?.length > 0 && album.producers?.length > 0;
        const hasDiscogs = album.discogs_release_id && album.discogs_master_id && album.discogs_genres?.length > 0;
        const hasImages = album.image_url && album.back_image_url;
        const hasStreaming = album.spotify_id && album.apple_music_id;
        const hasMetadata = album.lastfm_id && album.allmusic_id && album.wikipedia_url;
        const hasAudio = album.tempo_bpm;
        return hasMusicBrainz && hasDiscogs && hasImages && hasStreaming && hasMetadata && hasAudio;
      });
    }

    return NextResponse.json({
      success: true,
      albums: filteredAlbums.map(a => ({
        id: a.id,
        artist: a.artist,
        title: a.title,
        image_url: a.image_url
      }))
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
