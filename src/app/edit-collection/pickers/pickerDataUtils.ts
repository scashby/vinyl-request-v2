// src/app/edit-collection/pickers/pickerDataUtils.ts
'use client';

import { supabase } from "../../../lib/supabaseClient";

export interface PickerDataItem {
  id: string;
  name: string;
  count?: number;
}

// Storage Devices
export async function fetchStorageDevices(): Promise<PickerDataItem[]> {
  try {
    
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

// Packaging
export async function fetchPackaging(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('packaging')
      .not('packaging', 'is', null)
      .not('packaging', 'eq', '');

    if (error) {
      console.error('Error fetching packaging:', error);
      return [];
    }

    const packagingCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.packaging) {
        packagingCounts.set(
          row.packaging,
          (packagingCounts.get(row.packaging) || 0) + 1
        );
      }
    });

    return Array.from(packagingCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchPackaging:', error);
    return [];
  }
}

export async function updatePackaging(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ packaging: newName })
      .eq('packaging', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating packaging:', error);
    return false;
  }
}

export async function deletePackaging(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ packaging: null })
      .eq('packaging', id);
    
    return !error;
  } catch (error) {
    console.error('Error deleting packaging:', error);
    return false;
  }
}

export async function mergePackaging(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ packaging: targetId })
      .in('packaging', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging packaging:', error);
    return false;
  }
}

// Media Conditions
export async function fetchMediaConditions(): Promise<PickerDataItem[]> {
  // Standard grading system
  const conditions = [
    { id: 'Mint (M)', name: 'Mint (M)', count: 0 },
    { id: 'Near Mint (NM or M-)', name: 'Near Mint (NM or M-)', count: 0 },
    { id: 'Very Good Plus (VG+)', name: 'Very Good Plus (VG+)', count: 0 },
    { id: 'Very Good (VG)', name: 'Very Good (VG)', count: 0 },
    { id: 'Good Plus (G+)', name: 'Good Plus (G+)', count: 0 },
    { id: 'Good (G)', name: 'Good (G)', count: 0 },
    { id: 'Fair (F)', name: 'Fair (F)', count: 0 },
    { id: 'Poor (P)', name: 'Poor (P)', count: 0 },
  ];

  try {
    const { data } = await supabase
      .from('collection')
      .select('media_condition')
      .not('media_condition', 'is', null);

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.media_condition) {
        counts.set(row.media_condition, (counts.get(row.media_condition) || 0) + 1);
      }
    });

    return conditions.map(condition => ({
      ...condition,
      count: counts.get(condition.id) || 0,
    }));
  } catch (error) {
    console.error('Error in fetchMediaConditions:', error);
    return conditions;
  }
}

// Package Conditions
export async function fetchPackageConditions(): Promise<PickerDataItem[]> {
  // Standard grading system (same as media)
  const conditions = [
    { id: 'Mint (M)', name: 'Mint (M)', count: 0 },
    { id: 'Near Mint (NM or M-)', name: 'Near Mint (NM or M-)', count: 0 },
    { id: 'Very Good Plus (VG+)', name: 'Very Good Plus (VG+)', count: 0 },
    { id: 'Very Good (VG)', name: 'Very Good (VG)', count: 0 },
    { id: 'Good Plus (G+)', name: 'Good Plus (G+)', count: 0 },
    { id: 'Good (G)', name: 'Good (G)', count: 0 },
    { id: 'Fair (F)', name: 'Fair (F)', count: 0 },
    { id: 'Poor (P)', name: 'Poor (P)', count: 0 },
    { id: 'Generic', name: 'Generic', count: 0 },
    { id: 'No Cover', name: 'No Cover', count: 0 },
  ];

  try {
    const { data } = await supabase
      .from('collection')
      .select('package_sleeve_condition')
      .not('package_sleeve_condition', 'is', null);

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.package_sleeve_condition) {
        counts.set(row.package_sleeve_condition, (counts.get(row.package_sleeve_condition) || 0) + 1);
      }
    });

    return conditions.map(condition => ({
      ...condition,
      count: counts.get(condition.id) || 0,
    }));
  } catch (error) {
    console.error('Error in fetchPackageConditions:', error);
    return conditions;
  }
}

// Studios
export async function fetchStudios(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('studio')
      .not('studio', 'is', null)
      .not('studio', 'eq', '');

    if (error) {
      console.error('Error fetching studios:', error);
      return [];
    }

    const studioCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.studio) {
        studioCounts.set(
          row.studio,
          (studioCounts.get(row.studio) || 0) + 1
        );
      }
    });

    return Array.from(studioCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchStudios:', error);
    return [];
  }
}

export async function updateStudio(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ studio: newName })
      .eq('studio', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating studio:', error);
    return false;
  }
}

export async function mergeStudios(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ studio: targetId })
      .in('studio', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging studios:', error);
    return false;
  }
}

// Countries - UPDATED WITH STANDARD LIST
export async function fetchCountries(): Promise<PickerDataItem[]> {
  // Standard country list
  const standardCountries = [
    'US', 'UK', 'Canada', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
    'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria', 'Switzerland',
    'Japan', 'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Russia',
    'Poland', 'Czech Republic', 'Hungary', 'Portugal', 'Greece', 'Ireland', 'Israel',
    'South Korea', 'China', 'India', 'Europe', 'UK & Europe', 'USA & Canada',
  ];

  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('country')
      .not('country', 'is', null)
      .not('country', 'eq', '');

    if (error) {
      console.error('Error fetching countries:', error);
      return standardCountries.map(name => ({ id: name, name, count: 0 }))
        .sort((a, b) => {
          // Put US at the top
          if (a.name === 'US') return -1;
          if (b.name === 'US') return 1;
          // Sort rest alphabetically
          return a.name.localeCompare(b.name);
        });
    }

    const countryCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.country) {
        countryCounts.set(
          row.country,
          (countryCounts.get(row.country) || 0) + 1
        );
      }
    });

    // Combine standard countries with database countries
    const allCountries = new Set([...standardCountries, ...countryCounts.keys()]);

    return Array.from(allCountries)
      .map(name => ({
        id: name,
        name,
        count: countryCounts.get(name) || 0,
      }))
      .sort((a, b) => {
        // Put US at the top
        if (a.name === 'US') return -1;
        if (b.name === 'US') return 1;
        // Sort rest alphabetically
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error('Error in fetchCountries:', error);
    return standardCountries.map(name => ({ id: name, name, count: 0 }))
      .sort((a, b) => {
        // Put US at the top
        if (a.name === 'US') return -1;
        if (b.name === 'US') return 1;
        // Sort rest alphabetically
        return a.name.localeCompare(b.name);
      });
  }
}

// Sounds
export async function fetchSounds(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('sound')
      .not('sound', 'is', null)
      .not('sound', 'eq', '');

    if (error) {
      console.error('Error fetching sounds:', error);
      return [];
    }

    const soundCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.sound) {
        soundCounts.set(
          row.sound,
          (soundCounts.get(row.sound) || 0) + 1
        );
      }
    });

    return Array.from(soundCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchSounds:', error);
    return [];
  }
}

export async function updateSound(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ sound: newName })
      .eq('sound', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating sound:', error);
    return false;
  }
}

export async function mergeSounds(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ sound: targetId })
      .in('sound', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging sounds:', error);
    return false;
  }
}

// Vinyl Colors - UPDATED WITH STANDARD LIST AND MULTI-SELECT SUPPORT
export async function fetchVinylColors(): Promise<PickerDataItem[]> {
  // Standard vinyl colors
  const standardColors = [
    'Black', 'Red', 'Blue', 'Yellow', 'Orange', 'Green', 'Purple', 'Pink',
    'White', 'Transparent', 'Brown', 'Gold', 'Metallic', 'Marbled', 'Swirl',
    'Glow-in-the-Dark', 'Picture', 'Color-in-Color', 'Starburst', 'Splatter',
    'Liquid-Filled',
  ];

  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('vinyl_color')
      .not('vinyl_color', 'is', null);

    if (error) {
      console.error('Error fetching vinyl colors:', error);
      return standardColors.map(name => ({ id: name, name, count: 0 }));
    }

    const colorCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.vinyl_color) {
        // Handle both array and string values
        const colors = Array.isArray(row.vinyl_color) ? row.vinyl_color : [row.vinyl_color];
        colors.forEach(color => {
          if (color) {
            colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
          }
        });
      }
    });

    // Combine standard colors with database colors
    const allColors = new Set([...standardColors, ...colorCounts.keys()]);

    return Array.from(allColors)
      .map(name => ({
        id: name,
        name,
        count: colorCounts.get(name) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchVinylColors:', error);
    return standardColors.map(name => ({ id: name, name, count: 0 }));
  }
}

export async function updateVinylColor(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ vinyl_color: newName })
      .eq('vinyl_color', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating vinyl color:', error);
    return false;
  }
}

export async function mergeVinylColors(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ vinyl_color: targetId })
      .in('vinyl_color', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging vinyl colors:', error);
    return false;
  }
}

// Vinyl Weights - NEW FUNCTION WITH STANDARD WEIGHTS
export async function fetchVinylWeights(): Promise<PickerDataItem[]> {
  // Standard vinyl weights
  const standardWeights = [
    '80 gram vinyl',
    '100 gram vinyl',
    '120 gram vinyl',
    '140 gram vinyl',
    '160 gram vinyl',
    '180 gram vinyl',
    '200 gram vinyl',
  ];

  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('vinyl_weight')
      .not('vinyl_weight', 'is', null)
      .not('vinyl_weight', 'eq', '');

    if (error) {
      console.error('Error fetching vinyl weights:', error);
      return standardWeights.map(name => ({ id: name, name, count: 0 }));
    }

    const weightCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.vinyl_weight) {
        weightCounts.set(
          row.vinyl_weight,
          (weightCounts.get(row.vinyl_weight) || 0) + 1
        );
      }
    });

    // Combine standard weights with database weights
    const allWeights = new Set([...standardWeights, ...weightCounts.keys()]);

    return Array.from(allWeights)
      .map(name => ({
        id: name,
        name,
        count: weightCounts.get(name) || 0,
      }))
      .sort((a, b) => {
        // Sort by numeric value first
        const aNum = parseInt(a.name.match(/\d+/)?.[0] || '0');
        const bNum = parseInt(b.name.match(/\d+/)?.[0] || '0');
        return aNum - bNum;
      });
  } catch (error) {
    console.error('Error in fetchVinylWeights:', error);
    return standardWeights.map(name => ({ id: name, name, count: 0 }));
  }
}

// SPARS
export async function fetchSPARS(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('spars_code')
      .not('spars_code', 'is', null)
      .not('spars_code', 'eq', '');

    if (error) {
      console.error('Error fetching SPARS:', error);
      return [];
    }

    const sparsCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.spars_code) {
        sparsCounts.set(
          row.spars_code,
          (sparsCounts.get(row.spars_code) || 0) + 1
        );
      }
    });

    return Array.from(sparsCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchSPARS:', error);
    return [];
  }
}

export async function updateSPARS(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ spars_code: newName })
      .eq('spars_code', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating SPARS:', error);
    return false;
  }
}

export async function mergeSPARS(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ spars_code: targetId })
      .in('spars_code', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging SPARS:', error);
    return false;
  }
}

// Box Sets
export async function fetchBoxSets(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('box_set')
      .not('box_set', 'is', null)
      .not('box_set', 'eq', '');

    if (error) {
      console.error('Error fetching box sets:', error);
      return [];
    }

    const boxSetCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.box_set) {
        boxSetCounts.set(
          row.box_set,
          (boxSetCounts.get(row.box_set) || 0) + 1
        );
      }
    });

    return Array.from(boxSetCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchBoxSets:', error);
    return [];
  }
}

// Purchase Stores
export async function fetchPurchaseStores(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('purchase_store')
      .not('purchase_store', 'is', null)
      .not('purchase_store', 'eq', '');

    if (error) {
      console.error('Error fetching purchase stores:', error);
      return [];
    }

    const storeCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.purchase_store) {
        storeCounts.set(
          row.purchase_store,
          (storeCounts.get(row.purchase_store) || 0) + 1
        );
      }
    });

    return Array.from(storeCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchPurchaseStores:', error);
    return [];
  }
}

export async function updatePurchaseStore(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ purchase_store: newName })
      .eq('purchase_store', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating purchase store:', error);
    return false;
  }
}

export async function deletePurchaseStore(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ purchase_store: null })
      .eq('purchase_store', id);
    
    return !error;
  } catch (error) {
    console.error('Error deleting purchase store:', error);
    return false;
  }
}

export async function mergePurchaseStores(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ purchase_store: targetId })
      .in('purchase_store', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging purchase stores:', error);
    return false;
  }
}

// Owners
export async function fetchOwners(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('owner')
      .not('owner', 'is', null)
      .not('owner', 'eq', '');

    if (error) {
      console.error('Error fetching owners:', error);
      return [];
    }

    const ownerCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.owner) {
        ownerCounts.set(
          row.owner,
          (ownerCounts.get(row.owner) || 0) + 1
        );
      }
    });

    return Array.from(ownerCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchOwners:', error);
    return [];
  }
}

export async function updateOwner(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ owner: newName })
      .eq('owner', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating owner:', error);
    return false;
  }
}

export async function deleteOwner(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ owner: null })
      .eq('owner', id);
    
    return !error;
  } catch (error) {
    console.error('Error deleting owner:', error);
    return false;
  }
}

export async function mergeOwners(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ owner: targetId })
      .in('owner', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging owners:', error);
    return false;
  }
}

// Signees (for "Signed By")
export async function fetchSignees(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('signed_by')
      .not('signed_by', 'is', null);

    if (error) {
      console.error('Error fetching signees:', error);
      return [];
    }

    const signeeCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.signed_by) {
        // Handle both array and string values
        const signees = Array.isArray(row.signed_by) ? row.signed_by : [row.signed_by];
        signees.forEach(signee => {
          if (signee) {
            signeeCounts.set(signee, (signeeCounts.get(signee) || 0) + 1);
          }
        });
      }
    });

    return Array.from(signeeCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchSignees:', error);
    return [];
  }
}

// Tags (already exists, but adding explicit fetch for consistency)
export async function fetchTags(): Promise<PickerDataItem[]> {
  try {
    
    const { data, error } = await supabase
      .from('collection')
      .select('custom_tags')
      .not('custom_tags', 'is', null);

    if (error) {
      console.error('Error fetching tags:', error);
      return [];
    }

    const tagCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.custom_tags) {
        const tags = Array.isArray(row.custom_tags) ? row.custom_tags : [row.custom_tags];
        tags.forEach(tag => {
          if (tag) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        });
      }
    });

    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchTags:', error);
    return [];
  }
}

// ============================================================================
// CLASSICAL MUSIC FIELDS - NEW ADDITIONS
// ============================================================================

// Composers
export async function fetchComposers(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('composer')
      .not('composer', 'is', null)
      .not('composer', 'eq', '');

    if (error) {
      console.error('Error fetching composers:', error);
      return [];
    }

    const composerCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.composer) {
        composerCounts.set(
          row.composer,
          (composerCounts.get(row.composer) || 0) + 1
        );
      }
    });

    return Array.from(composerCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchComposers:', error);
    return [];
  }
}

export async function updateComposer(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ composer: newName })
      .eq('composer', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating composer:', error);
    return false;
  }
}

export async function mergeComposers(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ composer: targetId })
      .in('composer', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging composers:', error);
    return false;
  }
}

// Conductors
export async function fetchConductors(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('conductor')
      .not('conductor', 'is', null)
      .not('conductor', 'eq', '');

    if (error) {
      console.error('Error fetching conductors:', error);
      return [];
    }

    const conductorCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.conductor) {
        conductorCounts.set(
          row.conductor,
          (conductorCounts.get(row.conductor) || 0) + 1
        );
      }
    });

    return Array.from(conductorCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchConductors:', error);
    return [];
  }
}

export async function updateConductor(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ conductor: newName })
      .eq('conductor', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating conductor:', error);
    return false;
  }
}

export async function mergeConductors(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ conductor: targetId })
      .in('conductor', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging conductors:', error);
    return false;
  }
}

// Choruses
export async function fetchChoruses(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('chorus')
      .not('chorus', 'is', null)
      .not('chorus', 'eq', '');

    if (error) {
      console.error('Error fetching choruses:', error);
      return [];
    }

    const chorusCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.chorus) {
        chorusCounts.set(
          row.chorus,
          (chorusCounts.get(row.chorus) || 0) + 1
        );
      }
    });

    return Array.from(chorusCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchChoruses:', error);
    return [];
  }
}

export async function updateChorus(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ chorus: newName })
      .eq('chorus', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating chorus:', error);
    return false;
  }
}

export async function mergeChorus(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ chorus: targetId })
      .in('chorus', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging choruses:', error);
    return false;
  }
}

// Compositions
export async function fetchCompositions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('composition')
      .not('composition', 'is', null)
      .not('composition', 'eq', '');

    if (error) {
      console.error('Error fetching compositions:', error);
      return [];
    }

    const compositionCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.composition) {
        compositionCounts.set(
          row.composition,
          (compositionCounts.get(row.composition) || 0) + 1
        );
      }
    });

    return Array.from(compositionCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchCompositions:', error);
    return [];
  }
}

export async function updateComposition(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ composition: newName })
      .eq('composition', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating composition:', error);
    return false;
  }
}

export async function mergeCompositions(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ composition: targetId })
      .in('composition', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging compositions:', error);
    return false;
  }
}

// Orchestras
export async function fetchOrchestras(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('orchestra')
      .not('orchestra', 'is', null)
      .not('orchestra', 'eq', '');

    if (error) {
      console.error('Error fetching orchestras:', error);
      return [];
    }

    const orchestraCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.orchestra) {
        orchestraCounts.set(
          row.orchestra,
          (orchestraCounts.get(row.orchestra) || 0) + 1
        );
      }
    });

    return Array.from(orchestraCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchOrchestras:', error);
    return [];
  }
}

export async function updateOrchestra(id: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ orchestra: newName })
      .eq('orchestra', id);
    
    return !error;
  } catch (error) {
    console.error('Error updating orchestra:', error);
    return false;
  }
}

export async function mergeOrchestras(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('collection')
      .update({ orchestra: targetId })
      .in('orchestra', sourceIds);
    
    return !error;
  } catch (error) {
    console.error('Error merging orchestras:', error);
    return false;
  }
}

// ============================================================================
// PEOPLE / CREDITS FIELDS - NEW ADDITIONS
// ============================================================================

// Songwriters
export async function fetchSongwriters(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('songwriters')
      .not('songwriters', 'is', null);

    if (error) {
      console.error('Error fetching songwriters:', error);
      return [];
    }

    const songwriterCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.songwriters && Array.isArray(row.songwriters)) {
        row.songwriters.forEach(songwriter => {
          if (songwriter) {
            songwriterCounts.set(songwriter, (songwriterCounts.get(songwriter) || 0) + 1);
          }
        });
      }
    });

    return Array.from(songwriterCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchSongwriters:', error);
    return [];
  }
}

// Producers
export async function fetchProducers(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('producers')
      .not('producers', 'is', null);

    if (error) {
      console.error('Error fetching producers:', error);
      return [];
    }

    const producerCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.producers && Array.isArray(row.producers)) {
        row.producers.forEach(producer => {
          if (producer) {
            producerCounts.set(producer, (producerCounts.get(producer) || 0) + 1);
          }
        });
      }
    });

    return Array.from(producerCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchProducers:', error);
    return [];
  }
}

// Engineers
export async function fetchEngineers(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('engineers')
      .not('engineers', 'is', null);

    if (error) {
      console.error('Error fetching engineers:', error);
      return [];
    }

    const engineerCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.engineers && Array.isArray(row.engineers)) {
        row.engineers.forEach(engineer => {
          if (engineer) {
            engineerCounts.set(engineer, (engineerCounts.get(engineer) || 0) + 1);
          }
        });
      }
    });

    return Array.from(engineerCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchEngineers:', error);
    return [];
  }
}

// Musicians
export async function fetchMusicians(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection')
      .select('musicians')
      .not('musicians', 'is', null);

    if (error) {
      console.error('Error fetching musicians:', error);
      return [];
    }

    const musicianCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.musicians && Array.isArray(row.musicians)) {
        row.musicians.forEach(musician => {
          if (musician) {
            musicianCounts.set(musician, (musicianCounts.get(musician) || 0) + 1);
          }
        });
      }
    });

    return Array.from(musicianCounts.entries())
      .map(([name, count]) => ({
        id: name,
        name,
        count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error in fetchMusicians:', error);
    return [];
  }
}