// src/lib/enrichment-utils.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN ?? process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type DiscogsTrack = {
  position?: string;
  type_?: string;
  title?: string;
  duration?: string;
  artists?: Array<{ name: string; id?: number; join?: string }>;
};

type Track = {
  position?: string;
  title?: string;
  duration?: string;
  type_?: string;
  artist?: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

export async function enrichDiscogsTracklist(albumId: number) {
  try {
    if (!DISCOGS_TOKEN) {
      return { success: false, error: 'Discogs token not configured' };
    }

    const { data: album } = await supabase
      .from('collection')
      .select('id, artist, title, discogs_release_id, tracklists')
      .eq('id', albumId)
      .single();

    if (!album || !album.discogs_release_id) {
      return { success: false, error: 'No Discogs Release ID' };
    }

    // Check if already has tracks with artist info
    if (album.tracklists) {
      try {
        const existingTracks = JSON.parse(album.tracklists);
        if (Array.isArray(existingTracks) && existingTracks.length > 0) {
          const hasArtistData = existingTracks.some(t => t.artist && t.artist !== album.artist);
          if (hasArtistData) {
            return { success: true, skipped: true };
          }
        }
      } catch {}
    }

    // Fetch from Discogs
    const res = await fetch(`https://api.discogs.com/releases/${album.discogs_release_id}`, {
      headers: {
        'User-Agent': 'DeadwaxDialogues/1.0',
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`
      }
    });

    if (!res.ok) {
      return { success: false, error: `Discogs API error: ${res.status}` };
    }

    const discogsData = await res.json();
    
    if (!discogsData.tracklist || discogsData.tracklist.length === 0) {
      return { success: false, error: 'No tracklist found' };
    }

    const enrichedTracks = discogsData.tracklist.map((track: DiscogsTrack) => ({
      position: track.position || '',
      type_: track.type_ || 'track',
      title: track.title || '',
      duration: track.duration || '',
      artist: track.artists && track.artists.length > 0 
        ? track.artists.map(a => a.name).join(', ') 
        : undefined
    }));

    const tracksWithArtists = enrichedTracks.filter(t => t.artist).length;

    const { error: updateError } = await supabase
      .from('collection')
      .update({ tracklists: JSON.stringify(enrichedTracks) })
      .eq('id', albumId);

    if (updateError) {
      return { success: false, error: 'Database update failed' };
    }

    return {
      success: true,
      data: {
        totalTracks: enrichedTracks.length,
        tracksWithArtists
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function enrichGenius(albumId: number) {
  try {
    if (!GENIUS_TOKEN) {
      return { success: false, error: 'Genius token not configured' };
    }

    const { data: album } = await supabase
      .from('collection')
      .select('id, artist, title, tracklists')
      .eq('id', albumId)
      .single();

    if (!album) {
      return { success: false, error: 'Album not found' };
    }

    let tracks: Track[] = [];
    if (album.tracklists) {
      try {
        tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;
      } catch {
        return { success: false, error: 'Invalid tracklist format' };
      }
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { success: false, error: 'No tracklist found' };
    }

    const enrichedTracks: Track[] = [];
    let enrichedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const enrichedTracksList = [];
    const failedTracksList = [];

    for (const track of tracks) {
      if (!track.title || track.lyrics_url) {
        enrichedTracks.push(track);
        skippedCount++;
        continue;
      }

      try {
        const query = encodeURIComponent(`${album.artist} ${track.title}`);
        const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
          headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
        });

        if (!searchRes.ok) {
          throw new Error(`Genius API error: ${searchRes.status}`);
        }

        const searchData = await searchRes.json();
        const hit = searchData?.response?.hits?.[0];
        const lyricsUrl = hit?.result?.url;

        if (lyricsUrl) {
          enrichedTracks.push({ ...track, lyrics_url: lyricsUrl });
          enrichedCount++;
          enrichedTracksList.push({
            position: track.position || '',
            title: track.title,
            lyrics_url: lyricsUrl
          });
        } else {
          enrichedTracks.push(track);
          failedCount++;
          failedTracksList.push({
            position: track.position || '',
            title: track.title,
            error: 'No match found'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Search failed';
        enrichedTracks.push(track);
        failedCount++;
        failedTracksList.push({
          position: track.position || '',
          title: track.title,
          error: errorMsg
        });
      }
    }

    if (enrichedCount > 0) {
      const { error: updateError } = await supabase
        .from('collection')
        .update({ tracklists: JSON.stringify(enrichedTracks) })
        .eq('id', albumId);

      if (updateError) {
        return { success: false, error: 'Database update failed' };
      }
    }

    return {
      success: enrichedCount > 0 || skippedCount === tracks.length,
      data: {
        enrichedCount,
        skippedCount,
        failedCount,
        enrichedTracks: enrichedTracksList,
        failedTracks: failedTracksList
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}