// src/app/api/enrich-sources/batch/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  enrichMusicBrainz,
  enrichLastFm,
  enrichSpotifyEnhanced,
  enrichAppleMusicEnhanced,
  enrichAllMusic,
  enrichWikipedia,
  enrichCoverArtArchive,
  enrichAcousticBrainz,
  enrichGenius,
  enrichDiscogsMetadata,
  enrichDiscogsTracklist
} from 'lib/enrichment-utils';
import { hasValidDiscogsId } from 'lib/discogs-validation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type ServiceResult = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  skipped?: boolean;
};

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  musicbrainz?: ServiceResult;
  lastfm?: ServiceResult;
  spotify?: ServiceResult;
  appleMusic?: ServiceResult;
  allmusic?: ServiceResult;
  wikipedia?: ServiceResult;
  coverArt?: ServiceResult;
  acousticbrainz?: ServiceResult;
  discogsMetadata?: ServiceResult;
  discogsTracklist?: ServiceResult;
  genius?: ServiceResult;
};

function needsMusicBrainz(album: Record<string, unknown>): boolean {
  const musicians = album.musicians as unknown[] | undefined;
  const producers = album.producers as unknown[] | undefined;
  return !musicians?.length || !producers?.length;
}

function needsDiscogsMetadata(album: Record<string, unknown>): boolean {
  return !hasValidDiscogsId(album.discogs_release_id as string | null) ||
         !hasValidDiscogsId(album.discogs_master_id as string | null) ||
         !album.image_url ||
         !(album.discogs_genres as unknown[] | undefined)?.length;
}

function needsDiscogsTracklist(album: Record<string, unknown>): boolean {
  if (!album.discogs_release_id) return false;
  if (!album.tracklists) return true;
  try {
    const tracks = JSON.parse(album.tracklists as string);
    return !Array.isArray(tracks) || !tracks.some((t: { artist?: string }) => t.artist);
  } catch {
    return true;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cursor = body.cursor || 0;
    const limit = Math.min(body.limit || 20, 10);
    const folder = body.folder;
    const services = body.services || {
      musicbrainz: true,
      lastfm: true,
      spotify: true,
      appleMusic: true,
      allmusic: true,
      wikipedia: true,
      coverArt: true,
      acousticbrainz: true,
      discogsMetadata: true,
      discogsTracklist: true,
      genius: true
    };

    let query = supabase
      .from('collection')
      .select('id,artist,title,tracklists,spotify_id,apple_music_id,discogs_release_id,discogs_master_id,image_url,discogs_genres,folder,musicians,producers,musicbrainz_id,lastfm_url,allmusic_id,wikipedia_url,back_image_url,tempo_bpm')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(Math.min(limit, 10));

    if (folder && folder !== '') {
      query = query.eq('folder', folder);
    }

    const { data: albums, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!albums?.length) {
      return NextResponse.json({ success: true, processed: 0, results: [], hasMore: false });
    }

    const albumsNeedingEnrichment = albums.filter(album => 
      (services.musicbrainz && needsMusicBrainz(album)) ||
      (services.lastfm && !album.lastfm_url) ||
      (services.spotify && !album.spotify_id) ||
      (services.appleMusic && !album.apple_music_id) ||
      (services.allmusic && !album.allmusic_id) ||
      (services.wikipedia && !album.wikipedia_url) ||
      (services.coverArt && album.musicbrainz_id && !album.back_image_url) ||
      (services.acousticbrainz && album.musicbrainz_id && !album.tempo_bpm) ||
      (services.discogsMetadata && needsDiscogsMetadata(album)) ||
      (services.discogsTracklist && needsDiscogsTracklist(album))
    ).slice(0, Math.min(limit, 10));

    if (!albumsNeedingEnrichment.length && albums.length > 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
        hasMore: true,
        nextCursor: albums[albums.length - 1].id
      });
    }

    if (!albumsNeedingEnrichment.length) {
      return NextResponse.json({ success: true, processed: 0, results: [], hasMore: false });
    }

    const results: AlbumResult[] = [];

    for (const album of albumsNeedingEnrichment) {
      const albumResult: AlbumResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title
      };

      if (services.musicbrainz && needsMusicBrainz(album)) {
        const res = await enrichMusicBrainz(album.id);
        albumResult.musicbrainz = res;
        await sleep(1000);
      } else if (needsMusicBrainz(album)) {
        albumResult.musicbrainz = { success: true, skipped: true };
      }

      if (services.lastfm && !album.lastfm_url) {
        const res = await enrichLastFm(album.id);
        albumResult.lastfm = res;
        await sleep(1000);
      } else if (album.lastfm_url) {
        albumResult.lastfm = { success: true, skipped: true };
      }

      if (services.spotify && !album.spotify_id) {
        const res = await enrichSpotifyEnhanced(album.id);
        albumResult.spotify = res;
        await sleep(300);
      } else if (album.spotify_id) {
        albumResult.spotify = { success: true, skipped: true };
      }

      if (services.appleMusic && !album.apple_music_id) {
        const res = await enrichAppleMusicEnhanced(album.id);
        albumResult.appleMusic = res;
        await sleep(300);
      } else if (album.apple_music_id) {
        albumResult.appleMusic = { success: true, skipped: true };
      }

      if (services.allmusic && !album.allmusic_id) {
        const res = await enrichAllMusic(album.id);
        albumResult.allmusic = res;
        await sleep(2000);
      } else if (album.allmusic_id) {
        albumResult.allmusic = { success: true, skipped: true };
      }

      if (services.wikipedia && !album.wikipedia_url) {
        const res = await enrichWikipedia(album.id);
        albumResult.wikipedia = res;
        await sleep(1000);
      } else if (album.wikipedia_url) {
        albumResult.wikipedia = { success: true, skipped: true };
      }

      if (services.coverArt && album.musicbrainz_id && !album.back_image_url) {
        const res = await enrichCoverArtArchive(album.id);
        albumResult.coverArt = res;
        await sleep(300);
      } else if (album.back_image_url || !album.musicbrainz_id) {
        albumResult.coverArt = { success: true, skipped: true };
      }

      if (services.acousticbrainz && album.musicbrainz_id && !album.tempo_bpm) {
        const res = await enrichAcousticBrainz(album.id);
        albumResult.acousticbrainz = res;
        await sleep(1000);
      } else if (album.tempo_bpm || !album.musicbrainz_id) {
        albumResult.acousticbrainz = { success: true, skipped: true };
      }

      if (services.discogsMetadata && needsDiscogsMetadata(album)) {
        const res = await enrichDiscogsMetadata(album.id);
        albumResult.discogsMetadata = res;
        await sleep(1000);
      } else if (!needsDiscogsMetadata(album)) {
        albumResult.discogsMetadata = { success: true, skipped: true };
      }

      if (services.discogsTracklist && needsDiscogsTracklist(album)) {
        const res = await enrichDiscogsTracklist(album.id);
        albumResult.discogsTracklist = res;
        await sleep(500);
      } else if (!needsDiscogsTracklist(album)) {
        albumResult.discogsTracklist = { success: true, skipped: true };
      }

      if (services.genius && album.tracklists) {
        const res = await enrichGenius(album.id);
        albumResult.genius = res;
      }

      results.push(albumResult);
    }

    const hasMore = albums.length >= Math.min(limit, 10);
    const nextCursor = hasMore ? albums[albums.length - 1].id : null;

    return NextResponse.json({
      success: true,
      processed: albumsNeedingEnrichment.length,
      results,
      hasMore,
      nextCursor
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}