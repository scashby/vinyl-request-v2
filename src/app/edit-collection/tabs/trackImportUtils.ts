// src/app/edit-collection/tabs/trackImportUtils.ts
'use client';

// Track interface for import functions
interface Track {
  id: string;
  position: number;
  title: string;
  artist: string;
  duration: string;
  note: string;
  disc_number: number;
  side?: string;
  is_header?: boolean;
}

// Discogs API track interface
interface DiscogsTrack {
  position?: string;
  title?: string;
  duration?: string;
  artists?: { name: string }[];
  type_?: string;
}

// Spotify API track interface
interface SpotifyTrack {
  name?: string;
  artists?: { name: string }[];
  duration_ms?: number;
  disc_number?: number;
  track_number?: number;
}

/**
 * Parse duration from various formats to MM:SS
 */
function parseDuration(duration: string | number | undefined): string {
  if (!duration) return '';
  
  // If it's already a string in MM:SS format
  if (typeof duration === 'string' && duration.includes(':')) {
    return duration;
  }
  
  // If it's a number in seconds
  const seconds = typeof duration === 'number' ? duration : parseInt(duration);
  if (isNaN(seconds)) return '';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate unique track ID
 */
function generateTrackId(): string {
  return `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Import tracks from Discogs
 * Discogs has the most accurate pressing-specific track listings for vinyl
 */
export async function importTracksFromDiscogs(
  discogsReleaseId: string | number
): Promise<Track[]> {
  try {
    const response = await fetch(`https://api.discogs.com/releases/${discogsReleaseId}`, {
      headers: {
        'User-Agent': 'VinylRequestApp/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }

    const data = await response.json();
    const tracks: Track[] = [];
    let position = 1;

    // Discogs tracklist format: array of track objects
    if (data.tracklist && Array.isArray(data.tracklist)) {
      data.tracklist.forEach((track: DiscogsTrack) => {
        // Determine disc number from position (e.g., "A1", "B1", "C1" or "1-1", "2-1")
        const positionStr = track.position || '';
        let discNumber = 1;
        let side = '';
        let trackPosition = position; // Fallback to sequential
        
        // Handle vinyl sides (A1, B1, C1, D1)
        const sideMatch = positionStr.match(/^([A-Z])(\d+)?/);
        if (sideMatch) {
          side = sideMatch[1];
          // Extract track number from position (A1 = 1, A2 = 2, etc.)
          trackPosition = parseInt(sideMatch[2] || '1');
          // A/B = disc 1, C/D = disc 2, etc.
          discNumber = Math.ceil((side.charCodeAt(0) - 64) / 2);
        } else {
          // Handle disc-track format (1-1, 2-1)
          const discMatch = positionStr.match(/^(\d+)-(\d+)?/);
          if (discMatch) {
            discNumber = parseInt(discMatch[1]);
            trackPosition = parseInt(discMatch[2] || position.toString());
          }
        }

        // Check if this is a heading/header (only if Discogs explicitly marks it)
        const isHeader = track.type_ === 'heading';

        tracks.push({
          id: generateTrackId(),
          position: trackPosition, // ✅ Use extracted position number
          title: track.title || '',
          artist: track.artists?.[0]?.name || '',
          duration: parseDuration(track.duration),
          note: '',
          disc_number: discNumber,
          side: side,
          is_header: isHeader,
        });
        
        position++; // Increment fallback counter
      });
    }

    return tracks;
  } catch (error) {
    console.error('Error importing tracks from Discogs:', error);
    throw error;
  }
}

/**
 * Import tracks from Spotify
 * Fallback option - typically CD/streaming versions, may not match vinyl exactly
 */
export async function importTracksFromSpotify(
  spotifyAlbumId: string,
  accessToken: string
): Promise<Track[]> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/albums/${spotifyAlbumId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();
    const tracks: Track[] = [];
    let position = 1;

    // Spotify tracks format
    if (data.tracks && Array.isArray(data.tracks.items)) {
      data.tracks.items.forEach((track: SpotifyTrack) => {
        // Determine disc number and track position
        const discNumber = track.disc_number || 1;
        const trackPosition = track.track_number || position;

        tracks.push({
          id: generateTrackId(),
          position: trackPosition, // ✅ Use Spotify's track_number
          title: track.name || '',
          artist: track.artists?.[0]?.name || '',
          duration: parseDuration(Math.floor((track.duration_ms || 0) / 1000)),
          note: '',
          disc_number: discNumber,
          is_header: false,
        });
        
        position++; // Increment fallback counter
      });
    }

    return tracks;
  } catch (error) {
    console.error('Error importing tracks from Spotify:', error);
    throw error;
  }
}

/**
 * Get Spotify access token via server-side API route
 * This avoids exposing credentials in client-side code
 */
export async function getSpotifyAccessToken(): Promise<string> {
  try {
    const response = await fetch('/api/spotify-token');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get Spotify access token');
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Spotify token error:', error);
    throw new Error('Spotify API credentials not configured or authentication failed. Please check your environment variables in Vercel.');
  }
}

/**
 * Helper to extract Discogs release ID from URL or return the ID directly
 */
export function extractDiscogsReleaseId(input: string): string {
  // If it's just a number, return it
  if (/^\d+$/.test(input)) {
    return input;
  }
  
  // Try to extract from URL: https://www.discogs.com/release/123456-...
  const match = input.match(/\/release\/(\d+)/);
  return match ? match[1] : input;
}

/**
 * Helper to extract Spotify album ID from URL or return the ID directly
 */
export function extractSpotifyAlbumId(input: string): string {
  // If it's just an alphanumeric ID, return it
  if (/^[a-zA-Z0-9]+$/.test(input)) {
    return input;
  }
  
  // Try to extract from URL: https://open.spotify.com/album/abc123...
  const match = input.match(/album\/([a-zA-Z0-9]+)/);
  return match ? match[1] : input;
}
// AUDIT: inspected, no changes.
