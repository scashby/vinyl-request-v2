// src/app/api/enrich-sources/albums/route.ts
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
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

    const { data: albums, error } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          spotify_album_id,
          discogs_release_id,
          master:masters (
            id,
            title,
            cover_image_url,
            genres,
            styles,
            discogs_master_id,
            musicbrainz_release_group_id,
            artist:artists (name)
          ),
          release_tracks:release_tracks (
            recording:recordings (
              credits
            )
          )
        )
      `)
      .limit(limit);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const enrichedAlbums = (albums || []).map((album) => {
      const release = toSingle(album.release);
      const master = toSingle(release?.master);
      const credits = (release?.release_tracks ?? [])
        .map((track) => {
          const recording = toSingle(track.recording);
          return recording?.credits;
        })
        .filter((value) => typeof value === 'object' && value && !Array.isArray(value)) as Record<string, unknown>[];

      const musicians = credits.flatMap((credit) => {
        const albumPeople = (credit.album_people ?? credit.albumPeople) as Record<string, unknown> | undefined;
        const fromAlbum = Array.isArray(albumPeople?.musicians) ? (albumPeople?.musicians as string[]) : [];
        const direct = Array.isArray(credit.musicians) ? (credit.musicians as string[]) : [];
        return [...fromAlbum, ...direct];
      });

      const producers = credits.flatMap((credit) => {
        const albumPeople = (credit.album_people ?? credit.albumPeople) as Record<string, unknown> | undefined;
        const fromAlbum = Array.isArray(albumPeople?.producers) ? (albumPeople?.producers as string[]) : [];
        const direct = Array.isArray(credit.producers) ? (credit.producers as string[]) : [];
        return [...fromAlbum, ...direct];
      });

      const appleAlbumId =
        credits
          .map((credit) => {
            const albumDetails = (credit.album_details ?? credit.albumDetails ?? credit.album_metadata) as Record<string, unknown> | undefined;
            return albumDetails?.apple_music_id ?? null;
          })
          .find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;

      const backImage =
        credits
          .map((credit) => {
            const artwork = (credit.artwork ?? credit.album_artwork ?? credit.albumArtwork) as Record<string, unknown> | undefined;
            return artwork?.back_image_url ?? null;
          })
          .find((value) => typeof value === 'string' && value.trim().length > 0) ?? null;

      return {
        id: album.id,
        artist: toSingle(master?.artist)?.name ?? 'Unknown Artist',
        title: master?.title ?? 'Untitled',
        image_url: master?.cover_image_url ?? null,
        musicbrainz_id: master?.musicbrainz_release_group_id ?? null,
        musicians,
        producers,
        spotify_id: release?.spotify_album_id ?? null,
        apple_music_id: appleAlbumId,
        discogs_release_id: release?.discogs_release_id ?? null,
        discogs_master_id: master?.discogs_master_id ?? null,
        discogs_genres: master?.genres ?? null,
        back_image_url: backImage
      };
    });

    let filteredAlbums = enrichedAlbums;

    // Post-filter for complex categories
    if (category === 'needs-enrichment') {
      filteredAlbums = filteredAlbums.filter(album => {
        const hasMusicBrainz = album.musicbrainz_id && album.musicians?.length > 0 && album.producers?.length > 0;
        const hasDiscogs = album.discogs_release_id && album.discogs_master_id && album.discogs_genres?.length > 0;
        const hasImages = album.image_url;
        const hasStreaming = Boolean(album.spotify_id || album.apple_music_id);
        return !(hasMusicBrainz && hasDiscogs && hasImages && hasStreaming);
      });
    } else if (category === 'fully-enriched') {
      filteredAlbums = filteredAlbums.filter(album => {
        const hasMusicBrainz = album.musicbrainz_id && album.musicians?.length > 0 && album.producers?.length > 0;
        const hasDiscogs = album.discogs_release_id && album.discogs_master_id && album.discogs_genres?.length > 0;
        const hasImages = album.image_url;
        const hasStreaming = Boolean(album.spotify_id || album.apple_music_id);
        return hasMusicBrainz && hasDiscogs && hasImages && hasStreaming;
      });
    } else if (category === 'missing-musicians') {
      filteredAlbums = filteredAlbums.filter(album => !album.musicians || album.musicians.length === 0);
    } else if (category === 'missing-producers') {
      filteredAlbums = filteredAlbums.filter(album => !album.producers || album.producers.length === 0);
    } else if (category === 'missing-spotify') {
      filteredAlbums = filteredAlbums.filter(album => !album.spotify_id);
    } else if (category === 'missing-apple') {
      filteredAlbums = filteredAlbums.filter(album => !album.apple_music_id);
    } else if (category === 'missing-back-image') {
      filteredAlbums = filteredAlbums.filter(album => !album.image_url);
    } else if (category === 'missing-genres') {
      filteredAlbums = filteredAlbums.filter(album => !album.discogs_genres || album.discogs_genres.length === 0);
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
// AUDIT: inspected, no changes.
