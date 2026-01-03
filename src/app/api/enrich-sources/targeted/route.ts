// src/app/api/enrich-sources/targeted/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
} from '@/lib/enrichment-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  musicbrainz?: { success: boolean; error?: string; skipped?: boolean };
  lastfm?: { success: boolean; error?: string; skipped?: boolean };
  spotifyEnhanced?: { success: boolean; error?: string; skipped?: boolean };
  appleMusicEnhanced?: { success: boolean; error?: string; skipped?: boolean };
  allmusic?: { success: boolean; error?: string; skipped?: boolean };
  wikipedia?: { success: boolean; error?: string; skipped?: boolean };
  coverArtArchive?: { success: boolean; error?: string; skipped?: boolean };
  acousticbrainz?: { success: boolean; error?: string; skipped?: boolean };
  discogsMetadata?: { success: boolean; error?: string; skipped?: boolean };
  discogsTracklist?: { success: boolean; error?: string; skipped?: boolean };
  genius?: { success: boolean; error?: string; skipped?: boolean };
};

type ServiceSelection = {
  musicbrainz?: boolean;
  lastfm?: boolean;
  spotifyEnhanced?: boolean;
  appleMusicEnhanced?: boolean;
  allmusic?: boolean;
  wikipedia?: boolean;
  coverArtArchive?: boolean;
  acousticbrainz?: boolean;
  discogsMetadata?: boolean;
  discogsTracklist?: boolean;
  genius?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumIds, services } = body as { albumIds: number[]; services: ServiceSelection };

    if (!albumIds || !Array.isArray(albumIds) || albumIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'albumIds array required'
      }, { status: 400 });
    }

    const { data: albums, error: fetchError } = await supabase
      .from('collection')
      .select('id,artist,title,musicbrainz_id,musicians,producers,spotify_id,apple_music_id,lastfm_id,allmusic_id,wikipedia_url,tempo_bpm,discogs_release_id,tracklists')
      .in('id', albumIds);

    if (fetchError || !albums) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch albums'
      }, { status: 500 });
    }

    const results: AlbumResult[] = [];

    for (const album of albums) {
      const albumResult: AlbumResult = {
        albumId: album.id,
        artist: album.artist,
        title: album.title
      };

      // MusicBrainz
      if (services.musicbrainz) {
        const result = await enrichMusicBrainz(album.id);
        albumResult.musicbrainz = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(1000);
      }

      // Last.fm
      if (services.lastfm) {
        const result = await enrichLastFm(album.id);
        albumResult.lastfm = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(500);
      }

      // Spotify Enhanced
      if (services.spotifyEnhanced) {
        const result = await enrichSpotifyEnhanced(album.id);
        albumResult.spotifyEnhanced = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(300);
      }

      // Apple Music Enhanced
      if (services.appleMusicEnhanced) {
        const result = await enrichAppleMusicEnhanced(album.id);
        albumResult.appleMusicEnhanced = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(300);
      }

      // AllMusic
      if (services.allmusic) {
        const result = await enrichAllMusic(album.id);
        albumResult.allmusic = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(1000);
      }

      // Wikipedia
      if (services.wikipedia) {
        const result = await enrichWikipedia(album.id);
        albumResult.wikipedia = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(500);
      }

      // Cover Art Archive
      if (services.coverArtArchive) {
        const result = await enrichCoverArtArchive(album.id);
        albumResult.coverArtArchive = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(300);
      }

      // AcousticBrainz
      if (services.acousticbrainz) {
        const result = await enrichAcousticBrainz(album.id);
        albumResult.acousticbrainz = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(1000);
      }

      // Discogs Metadata
      if (services.discogsMetadata) {
        const result = await enrichDiscogsMetadata(album.id);
        albumResult.discogsMetadata = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(1000);
      }

      // Discogs Tracklist
      if (services.discogsTracklist) {
        const result = await enrichDiscogsTracklist(album.id);
        albumResult.discogsTracklist = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
        await sleep(500);
      }

      // Genius
      if (services.genius) {
        const result = await enrichGenius(album.id);
        albumResult.genius = {
          success: result.success,
          error: result.error,
          skipped: result.skipped
        };
      }

      results.push(albumResult);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}