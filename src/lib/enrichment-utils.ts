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

type DiscogsResponse = {
  master_id?: number;
  images?: Array<{ uri: string }>;
  genres?: string[];
  styles?: string[];
  tracklist?: DiscogsTrack[];
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

async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsResponse> {
  const url = `https://api.discogs.com/releases/${releaseId}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Discogs API returned ${res.status}`);
  }
  
  return await res.json();
}

async function searchDiscogsForRelease(artist: string, title: string, year?: string): Promise<string | null> {
  const params = new URLSearchParams({
    artist,
    release_title: title,
    type: 'release',
    per_page: '1'
  });
  
  if (year) {
    params.set('year', year);
  }
  
  const url = `https://api.discogs.com/database/search?${params.toString()}`;
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${DISCOGS_TOKEN}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Discogs search returned ${res.status}`);
  }
  
  const data = await res.json();
  const firstResult = data.results?.[0];
  
  if (firstResult?.id) {
    return String(firstResult.id);
  }
  
  return null;
}

export async function enrichDiscogsMetadata(albumId: number) {
  try {
    if (!DISCOGS_TOKEN) {
      return { success: false, error: 'Discogs token not configured' };
    }

    const { data: album } = await supabase
      .from('collection')
      .select('id, artist, title, year, discogs_release_id, discogs_master_id, image_url, discogs_genres, discogs_styles, tracklists')
      .eq('id', albumId)
      .single();

    if (!album) {
      return { success: false, error: 'Album not found' };
    }

    let releaseId = album.discogs_release_id;
    let foundReleaseId = false;
    
    const hasValidReleaseId = releaseId && releaseId.trim() && 
      releaseId !== 'null' && releaseId !== 'undefined' && releaseId !== '0';

    if (!hasValidReleaseId) {
      releaseId = await searchDiscogsForRelease(album.artist, album.title, album.year);
      
      if (!releaseId) {
        return { success: false, error: 'No match found on Discogs' };
      }
      
      foundReleaseId = true;
    }

    const needsMasterId = !album.discogs_master_id || album.discogs_master_id.trim() === '' || 
      album.discogs_master_id === 'null' || album.discogs_master_id === 'undefined' || album.discogs_master_id === '0';
    const needsImage = !album.image_url;
    const needsGenres = !album.discogs_genres || album.discogs_genres.length === 0;
    const needsTracklist = !album.tracklists;

    if (!foundReleaseId && !needsMasterId && !needsImage && !needsGenres && !needsTracklist) {
      return { success: true, skipped: true };
    }

    const discogsData = await fetchDiscogsRelease(releaseId);

    const updateData: Record<string, unknown> = {};

    if (foundReleaseId) {
      updateData.discogs_release_id = releaseId;
    }

    if (needsMasterId && discogsData.master_id) {
      updateData.discogs_master_id = String(discogsData.master_id);
    }

    if (needsImage && discogsData.images && discogsData.images.length > 0) {
      updateData.image_url = discogsData.images[0].uri;
    }

    if (needsGenres) {
      const combined = [
        ...(discogsData.genres || []),
        ...(discogsData.styles || [])
      ];
      const unique = Array.from(new Set(combined));
      
      if (unique.length > 0) {
        updateData.discogs_genres = unique;
        updateData.discogs_styles = unique;
      }
    }

    if (needsTracklist && discogsData.tracklist && discogsData.tracklist.length > 0) {
      const tracks = discogsData.tracklist.map(track => ({
        position: track.position || '',
        type_: track.type_ || 'track',
        title: track.title || '',
        duration: track.duration || '',
        artist: track.artists?.map(a => a.name).join(', ')
      }));
      
      updateData.tracklists = JSON.stringify(tracks);
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true, skipped: true };
    }

    const { error: updateError } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (updateError) {
      return { success: false, error: 'Database update failed' };
    }

    return {
      success: true,
      data: {
        foundReleaseId: foundReleaseId ? releaseId : undefined,
        addedMasterId: !!updateData.discogs_master_id,
        addedImage: !!updateData.image_url,
        addedGenres: !!updateData.discogs_genres,
        addedTracklist: !!updateData.tracklists
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

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