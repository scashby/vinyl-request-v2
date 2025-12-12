// src/app/edit-collection/pickers/pickerDataUtils.ts
import { createClient } from '@/utils/supabase/client';

export interface PickerDataItem {
  id: string;
  name: string;
  count: number;
}

/**
 * Fetch all unique labels with counts from collection
 */
export async function fetchLabels(): Promise<PickerDataItem[]> {
  const supabase = createClient();
  
  // Get all albums with their labels
  const { data: albums, error } = await supabase
    .from('collection')
    .select('spotify_label, apple_music_label')
    .not('spotify_label', 'is', null)
    .or('spotify_label.neq.null,apple_music_label.neq.null');

  if (error || !albums) {
    console.error('Error fetching labels:', error);
    return [];
  }

  // Aggregate counts
  const labelCounts = new Map<string, number>();
  
  albums.forEach(album => {
    const label = album.spotify_label || album.apple_music_label;
    if (label) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  });

  // Convert to array and sort
  return Array.from(labelCounts.entries())
    .map(([name, count]) => ({
      id: name, // Use name as ID for now
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all unique formats with counts from collection
 */
export async function fetchFormats(): Promise<PickerDataItem[]> {
  const supabase = createClient();
  
  const { data: albums, error } = await supabase
    .from('collection')
    .select('format')
    .not('format', 'is', null);

  if (error || !albums) {
    console.error('Error fetching formats:', error);
    return [];
  }

  // Aggregate counts
  const formatCounts = new Map<string, number>();
  
  albums.forEach(album => {
    if (album.format) {
      formatCounts.set(album.format, (formatCounts.get(album.format) || 0) + 1);
    }
  });

  // Convert to array and sort
  return Array.from(formatCounts.entries())
    .map(([name, count]) => ({
      id: name,
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all unique genres with counts from collection
 */
export async function fetchGenres(): Promise<PickerDataItem[]> {
  const supabase = createClient();
  
  const { data: albums, error } = await supabase
    .from('collection')
    .select('discogs_genres')
    .not('discogs_genres', 'is', null);

  if (error || !albums) {
    console.error('Error fetching genres:', error);
    return [];
  }

  // Aggregate counts (genres are arrays)
  const genreCounts = new Map<string, number>();
  
  albums.forEach(album => {
    if (album.discogs_genres && Array.isArray(album.discogs_genres)) {
      album.discogs_genres.forEach(genre => {
        if (genre) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      });
    }
  });

  // Convert to array and sort
  return Array.from(genreCounts.entries())
    .map(([name, count]) => ({
      id: name,
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all unique locations with counts from collection
 */
export async function fetchLocations(): Promise<PickerDataItem[]> {
  const supabase = createClient();
  
  const { data: albums, error } = await supabase
    .from('collection')
    .select('location')
    .not('location', 'is', null);

  if (error || !albums) {
    console.error('Error fetching locations:', error);
    return [];
  }

  // Aggregate counts
  const locationCounts = new Map<string, number>();
  
  albums.forEach(album => {
    if (album.location) {
      locationCounts.set(album.location, (locationCounts.get(album.location) || 0) + 1);
    }
  });

  // Convert to array and sort
  return Array.from(locationCounts.entries())
    .map(([name, count]) => ({
      id: name,
      name,
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Update a label across all albums
 */
export async function updateLabel(oldName: string, newName: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error: spotifyError } = await supabase
    .from('collection')
    .update({ spotify_label: newName })
    .eq('spotify_label', oldName);

  const { error: appleError } = await supabase
    .from('collection')
    .update({ apple_music_label: newName })
    .eq('apple_music_label', oldName);

  if (spotifyError || appleError) {
    console.error('Error updating label:', spotifyError || appleError);
    return false;
  }

  return true;
}

/**
 * Update a format across all albums
 */
export async function updateFormat(oldName: string, newName: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('collection')
    .update({ format: newName })
    .eq('format', oldName);

  if (error) {
    console.error('Error updating format:', error);
    return false;
  }

  return true;
}

/**
 * Update a location across all albums
 */
export async function updateLocation(oldName: string, newName: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('collection')
    .update({ location: newName })
    .eq('location', oldName);

  if (error) {
    console.error('Error updating location:', error);
    return false;
  }

  return true;
}

/**
 * Delete a label (set to null across all albums)
 */
export async function deleteLabel(name: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error: spotifyError } = await supabase
    .from('collection')
    .update({ spotify_label: null })
    .eq('spotify_label', name);

  const { error: appleError } = await supabase
    .from('collection')
    .update({ apple_music_label: null })
    .eq('apple_music_label', name);

  if (spotifyError || appleError) {
    console.error('Error deleting label:', spotifyError || appleError);
    return false;
  }

  return true;
}

/**
 * Merge labels - update all albums with mergeFrom labels to mergeTo label
 */
export async function mergeLabels(primaryName: string, mergeFromNames: string[]): Promise<boolean> {
  const supabase = createClient();
  
  for (const oldName of mergeFromNames) {
    const success = await updateLabel(oldName, primaryName);
    if (!success) return false;
  }

  return true;
}

/**
 * Merge formats
 */
export async function mergeFormats(primaryName: string, mergeFromNames: string[]): Promise<boolean> {
  const supabase = createClient();
  
  for (const oldName of mergeFromNames) {
    const success = await updateFormat(oldName, primaryName);
    if (!success) return false;
  }

  return true;
}

/**
 * Merge locations
 */
export async function mergeLocations(primaryName: string, mergeFromNames: string[]): Promise<boolean> {
  const supabase = createClient();
  
  for (const oldName of mergeFromNames) {
    const success = await updateLocation(oldName, primaryName);
    if (!success) return false;
  }

  return true;
}