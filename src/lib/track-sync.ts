// src/lib/track-sync.ts - Core track synchronization logic
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

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

type SyncResult = {
  success: boolean;
  albumId: number;
  tracksAdded: number;
  tracksUpdated: number;
  tracksDeleted: number;
  error?: string;
};

/**
 * Sync tracks for a single album from JSON to tracks table
 * This is the core function called by all sync operations
 */
export async function syncTracksFromAlbum(albumId: number): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    albumId,
    tracksAdded: 0,
    tracksUpdated: 0,
    tracksDeleted: 0
  };

  try {
    // Fetch album and its tracklists JSON
    const { data: album, error: fetchError } = await supabase
      .from('collection')
      .select('id, tracklists')
      .eq('id', albumId)
      .single();

    if (fetchError || !album) {
      result.error = `Album not found: ${fetchError?.message || 'Unknown error'}`;
      await logSyncOperation(result);
      return result;
    }

    // Parse tracklists JSON
    let tracks: Track[] = [];
    if (album.tracklists) {
      try {
        tracks = typeof album.tracklists === 'string' 
          ? JSON.parse(album.tracklists)
          : album.tracklists;
        
        if (!Array.isArray(tracks)) {
          tracks = [];
        }
      } catch (parseError) {
        result.error = `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`;
        await logSyncOperation(result);
        return result;
      }
    }

    // Get existing tracks for this album
    const { data: existingTracks, error: existingError } = await supabase
      .from('tracks')
      .select('id, position')
      .eq('album_id', albumId);

    if (existingError) {
      result.error = `Failed to fetch existing tracks: ${existingError.message}`;
      await logSyncOperation(result);
      return result;
    }

    const existingPositions = new Set(existingTracks?.map(t => t.position) || []);
    const newPositions = new Set(tracks.map(t => t.position || '').filter(Boolean));

    // Determine what to delete (tracks in DB but not in JSON)
    const positionsToDelete = Array.from(existingPositions).filter(pos => !newPositions.has(pos));
    
    if (positionsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('tracks')
        .delete()
        .eq('album_id', albumId)
        .in('position', positionsToDelete);

      if (deleteError) {
        result.error = `Failed to delete tracks: ${deleteError.message}`;
        await logSyncOperation(result);
        return result;
      }

      result.tracksDeleted = positionsToDelete.length;
    }

    // Insert or update tracks
    for (const track of tracks) {
      if (!track.position || !track.title) {
        // Skip tracks without position or title
        continue;
      }

      const trackData = {
        album_id: albumId,
        position: track.position,
        title: track.title,
        duration: track.duration || null,
        artist: track.artist || null,
        type: track.type_ || 'track',
        lyrics: track.lyrics || null,
        lyrics_source: track.lyrics_source || null,
        lyrics_url: track.lyrics_url || null
      };

      if (existingPositions.has(track.position)) {
        // Update existing track
        const { error: updateError } = await supabase
          .from('tracks')
          .update(trackData)
          .eq('album_id', albumId)
          .eq('position', track.position);

        if (updateError) {
          console.error(`Failed to update track ${track.position}:`, updateError);
        } else {
          result.tracksUpdated++;
        }
      } else {
        // Insert new track
        const { error: insertError } = await supabase
          .from('tracks')
          .insert([trackData]);

        if (insertError) {
          console.error(`Failed to insert track ${track.position}:`, insertError);
        } else {
          result.tracksAdded++;
        }
      }
    }

    result.success = true;
    await logSyncOperation(result);
    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    await logSyncOperation(result);
    return result;
  }
}

/**
 * Sync tracks for multiple albums in batch
 */
export async function syncTracksBatch(
  albumIds: number[]
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const albumId of albumIds) {
    const result = await syncTracksFromAlbum(albumId);
    results.push(result);
  }

  return results;
}

/**
 * Get sync statistics
 */
export async function getSyncStats(): Promise<{
  totalAlbums: number;
  albumsWithTracks: number;
  totalTracksInTable: number;
  albumsNeedingSync: number;
}> {
  const { count: totalAlbums } = await supabase
    .from('collection')
    .select('id', { count: 'exact', head: true });

  const { count: albumsWithTracks } = await supabase
    .from('collection')
    .select('id', { count: 'exact', head: true })
    .not('tracklists', 'is', null);

  const { count: totalTracksInTable } = await supabase
    .from('tracks')
    .select('id', { count: 'exact', head: true });

  // Albums with tracklists but no tracks in table
  const { data: albumsWithTracklistsData } = await supabase
    .from('collection')
    .select('id')
    .not('tracklists', 'is', null);

  const albumIdsWithTracklists = (albumsWithTracklistsData || []).map(a => a.id);

  let albumsNeedingSync = 0;
  if (albumIdsWithTracklists.length > 0) {
    const { data: albumsWithTracksInTable } = await supabase
      .from('tracks')
      .select('album_id')
      .in('album_id', albumIdsWithTracklists);

    const albumIdsWithTracksInTable = new Set(
      (albumsWithTracksInTable || []).map(t => t.album_id)
    );

    albumsNeedingSync = albumIdsWithTracklists.filter(
      id => !albumIdsWithTracksInTable.has(id)
    ).length;
  }

  return {
    totalAlbums: totalAlbums || 0,
    albumsWithTracks: albumsWithTracks || 0,
    totalTracksInTable: totalTracksInTable || 0,
    albumsNeedingSync
  };
}

/**
 * Log sync operation to track_sync_log table
 */
async function logSyncOperation(result: SyncResult): Promise<void> {
  try {
    await supabase.from('track_sync_log').insert([{
      album_id: result.albumId,
      tracks_added: result.tracksAdded,
      tracks_updated: result.tracksUpdated,
      tracks_deleted: result.tracksDeleted,
      status: result.success ? 'success' : 'failed',
      error_message: result.error || null
    }]);
  } catch (error) {
    // Don't throw - logging failure shouldn't break sync
    console.error('Failed to log sync operation:', error);
  }
}

/**
 * Validate track data integrity
 */
export async function validateTrackIntegrity(): Promise<{
  orphanedTracks: number;
  duplicatePositions: number;
  tracksWithoutPosition: number;
  tracksWithoutTitle: number;
}> {
  // Orphaned tracks (track references non-existent album)
  const { count: orphanedTracks } = await supabase
    .from('tracks')
    .select('id', { count: 'exact', head: true })
    .not('album_id', 'in', 
      supabase.from('collection').select('id')
    );

  // Tracks without position
  const { count: tracksWithoutPosition } = await supabase
    .from('tracks')
    .select('id', { count: 'exact', head: true })
    .or('position.is.null,position.eq.');

  // Tracks without title
  const { count: tracksWithoutTitle } = await supabase
    .from('tracks')
    .select('id', { count: 'exact', head: true })
    .or('title.is.null,title.eq.');

  // Note: duplicatePositions would require more complex query
  // For now, we rely on the unique constraint to prevent them

  return {
    orphanedTracks: orphanedTracks || 0,
    duplicatePositions: 0, // TODO: Implement if needed
    tracksWithoutPosition: tracksWithoutPosition || 0,
    tracksWithoutTitle: tracksWithoutTitle || 0
  };
}