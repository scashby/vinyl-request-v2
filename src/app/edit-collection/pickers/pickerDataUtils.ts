// src/app/edit-collection/pickers/pickerDataUtils.ts
'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export interface PickerDataItem {
  id: string;
  name: string;
  count?: number;
}

// Storage Devices
export async function fetchStorageDevices(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    // Fetch unique storage devices from collection table
    const { data, error } = await supabase
      .from('collection')
      .select('storage_device')
      .not('storage_device', 'is', null)
      .not('storage_device', 'eq', '');

    if (error) {
      console.error('Error fetching storage devices:', error);
      return [];
    }

    // Count occurrences and create picker items
    const deviceCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.storage_device) {
        deviceCounts.set(
          row.storage_device,
          (deviceCounts.get(row.storage_device) || 0) + 1
        );
      }
    });

    // Convert to PickerDataItem array
    return Array.from(deviceCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchStorageDevices:', error);
    return [];
  }
}

// Labels
export async function fetchLabels(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('collection')
      .select('spotify_label')
      .not('spotify_label', 'is', null)
      .not('spotify_label', 'eq', '');

    if (error) {
      console.error('Error fetching labels:', error);
      return [];
    }

    const labelCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.spotify_label) {
        labelCounts.set(
          row.spotify_label,
          (labelCounts.get(row.spotify_label) || 0) + 1
        );
      }
    });

    return Array.from(labelCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchLabels:', error);
    return [];
  }
}

// Formats
export async function fetchFormats(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('collection')
      .select('format')
      .not('format', 'is', null)
      .not('format', 'eq', '');

    if (error) {
      console.error('Error fetching formats:', error);
      return [];
    }

    const formatCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.format) {
        formatCounts.set(
          row.format,
          (formatCounts.get(row.format) || 0) + 1
        );
      }
    });

    return Array.from(formatCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchFormats:', error);
    return [];
  }
}

// Genres
export async function fetchGenres(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('collection')
      .select('discogs_genres, spotify_genres')
      .not('discogs_genres', 'is', null)
      .not('spotify_genres', 'is', null);

    if (error) {
      console.error('Error fetching genres:', error);
      return [];
    }

    const genreCounts = new Map<string, number>();
    data?.forEach(row => {
      const allGenres = [
        ...(row.discogs_genres || []),
        ...(row.spotify_genres || [])
      ];
      allGenres.forEach(genre => {
        if (genre) {
          genreCounts.set(
            genre,
            (genreCounts.get(genre) || 0) + 1
          );
        }
      });
    });

    return Array.from(genreCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchGenres:', error);
    return [];
  }
}

// Locations
export async function fetchLocations(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('collection')
      .select('folder')
      .not('folder', 'is', null)
      .not('folder', 'eq', '');

    if (error) {
      console.error('Error fetching locations:', error);
      return [];
    }

    const locationCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.folder) {
        locationCounts.set(
          row.folder,
          (locationCounts.get(row.folder) || 0) + 1
        );
      }
    });

    return Array.from(locationCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchLocations:', error);
    return [];
  }
}

// Artists
export async function fetchArtists(): Promise<PickerDataItem[]> {
  try {
    const supabase = createClientComponentClient();
    
    const { data, error } = await supabase
      .from('collection')
      .select('artist')
      .not('artist', 'is', null)
      .not('artist', 'eq', '');

    if (error) {
      console.error('Error fetching artists:', error);
      return [];
    }

    const artistCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.artist) {
        artistCounts.set(
          row.artist,
          (artistCounts.get(row.artist) || 0) + 1
        );
      }
    });

    return Array.from(artistCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchArtists:', error);
    return [];
  }
}

// Update functions
export async function updateLabel(id: string, newName: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ spotify_label: newName })
      .eq('spotify_label', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating label:', error);
    return false;
  }
}

export async function updateFormat(id: string, newName: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ format: newName })
      .eq('format', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating format:', error);
    return false;
  }
}

export async function updateLocation(id: string, newName: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ folder: newName })
      .eq('folder', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating location:', error);
    return false;
  }
}

export async function updateArtist(id: string, newName: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ artist: newName })
      .eq('artist', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating artist:', error);
    return false;
  }
}

// Delete functions
export async function deleteLabel(id: string): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ spotify_label: null })
      .eq('spotify_label', id);
    
    return !error;
  } catch (error) {
    console.error('Error deleting label:', error);
    return false;
  }
}

// Merge functions
export async function mergeLabels(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ spotify_label: targetId })
      .in('spotify_label', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging labels:', error);
    return false;
  }
}

export async function mergeFormats(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ format: targetId })
      .in('format', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging formats:', error);
    return false;
  }
}

export async function mergeLocations(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ folder: targetId })
      .in('folder', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging locations:', error);
    return false;
  }
}

export async function mergeArtists(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('collection')
      .update({ artist: targetId })
      .in('artist', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging artists:', error);
    return false;
  }
}