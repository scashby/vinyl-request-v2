// src/app/edit-collection/pickers/pickerDataUtils.ts
'use client';

import { supabase } from "../../../lib/supabaseClient";

export interface PickerDataItem {
  id: string;
  name: string;
  count?: number;
  sortName?: string;
}

interface SmartListItem {
  name: string;
  sort_name: string;
}

// Helper type for dynamic row access
type CollectionRow = Record<string, unknown>;

// Sorting helper for Grades (Mint -> Poor)
const GRADE_RANKS: Record<string, number> = {
  'Sealed': 0,
  'Mint (M)': 1,
  'Near Mint (NM or M-)': 2,
  'Very Good Plus (VG+)': 3,
  'Very Good (VG)': 4,
  'Good Plus (G+)': 5,
  'Good (G)': 6,
  'Fair (F)': 7,
  'Poor (P)': 8,
  'Generic': 9,
  'No Cover': 10
};

function getGradeRank(name: string): number {
  return GRADE_RANKS[name] ?? 99; // Unknown grades go to the bottom
}

// ============================================================================
// HELPER: SMART LISTS (JSONB ARRAYS)
// Handles: Musicians, Songwriters, Producers, Engineers
// ============================================================================

async function fetchSmartList(column: string): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('collection_v2_archive')
      .select(column)
      .not(column, 'is', null);

    if (error) {
      console.error(`Error fetching ${column}:`, error);
      return [];
    }

    const map = new Map<string, { count: number; sortName: string }>();

    data?.forEach((row) => {
      // Cast to unknown first to avoid strict type overlap errors
      const safeRow = row as unknown as Record<string, unknown>; 
      const items = safeRow[column] as SmartListItem[];
      
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (!item.name) return;
          const current = map.get(item.name);
          const sortVal = item.sort_name || item.name;

          if (current) {
            current.count++;
            // If we find a "better" sort name (one that isn't identical to name), adopt it
            if (current.sortName === item.name && sortVal !== item.name) {
              current.sortName = sortVal;
            }
          } else {
            map.set(item.name, { count: 1, sortName: sortVal });
          }
        });
      }
    });

    return Array.from(map.entries())
      .map(([name, info]) => ({
        id: name,
        name,
        count: info.count,
        sortName: info.sortName
      }))
      .sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch (error) {
    console.error(`Error in fetchSmartList for ${column}:`, error);
    return [];
  }
}

async function updateSmartList(column: string, oldName: string, newName: string, newSortName?: string): Promise<boolean> {
  try {
    const { data: rows, error: fetchError } = await supabase
      .from('collection_v2_archive')
      .select(`id, ${column}`)
      .not(column, 'is', null);

    if (fetchError || !rows) return false;

    const updates = rows.reduce((acc: { id: string; [key: string]: unknown }[], row) => {
      const collectionRow = row as unknown as CollectionRow;
      const list = collectionRow[column] as SmartListItem[];
      
      let changed = false;
      
      if (!Array.isArray(list)) return acc;

      const newList = list.map(item => {
        if (item.name === oldName) {
          changed = true;
          return {
            name: newName,
            sort_name: newSortName || item.sort_name || newName
          };
        }
        return item;
      });

      if (changed) {
        acc.push({ id: collectionRow.id as string, [column]: newList });
      }
      return acc;
    }, []);

    if (updates.length === 0) return true;

    const { error: updateError } = await supabase
      .from('collection_v2_archive')
      .upsert(updates);

    if (updateError) {
      console.error(`Error updating ${column}:`, updateError);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error in updateSmartList for ${column}:`, error);
    return false;
  }
}

async function deleteSmartList(column: string, nameToDelete: string): Promise<boolean> {
  try {
    const { data: rows, error: fetchError } = await supabase
      .from('collection_v2_archive')
      .select(`id, ${column}`)
      .not(column, 'is', null);

    if (fetchError || !rows) return false;

    const updates = rows.reduce((acc: { id: string; [key: string]: unknown }[], row) => {
      const collectionRow = row as unknown as CollectionRow;
      const list = collectionRow[column] as SmartListItem[];
      
      if (!Array.isArray(list)) return acc;

      const originalLen = list.length;
      const newList = list.filter(item => item.name !== nameToDelete);

      if (newList.length !== originalLen) {
        acc.push({ id: collectionRow.id as string, [column]: newList });
      }
      return acc;
    }, []);

    if (updates.length > 0) {
      const { error } = await supabase.from('collection_v2_archive').upsert(updates);
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function mergeSmartList(column: string, targetName: string, sourceNames: string[]): Promise<boolean> {
  try {
    const { data: rows, error: fetchError } = await supabase
      .from('collection_v2_archive')
      .select(`id, ${column}`)
      .not(column, 'is', null);

    if (fetchError || !rows) return false;

    const sourceSet = new Set(sourceNames);
    
    const updates = rows.reduce((acc: { id: string; [key: string]: unknown }[], row) => {
      const collectionRow = row as unknown as CollectionRow;
      const list = collectionRow[column] as SmartListItem[]; 
      
      if (!Array.isArray(list)) return acc;

      const hasSource = list.some(item => sourceSet.has(item.name));
      if (!hasSource) return acc;

      const filtered = list.filter(item => !sourceSet.has(item.name));
      const hasTarget = filtered.some(item => item.name === targetName);

      if (!hasTarget) {
        filtered.push({ name: targetName, sort_name: targetName });
      }

      acc.push({ id: collectionRow.id as string, [column]: filtered });
      return acc;
    }, []);

    if (updates.length > 0) {
      const { error } = await supabase.from('collection_v2_archive').upsert(updates);
      if (error) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function fetchStorageDevices(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('storage_device').not('storage_device', 'is', null).not('storage_device', 'eq', '');
    if (error) return [];
    const deviceCounts = new Map<string, number>();
    data?.forEach(row => { if (row.storage_device) deviceCounts.set(row.storage_device, (deviceCounts.get(row.storage_device) || 0) + 1); });
    return Array.from(deviceCounts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchLabels(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('releases')
      .select('label')
      .not('label', 'is', null)
      .not('label', 'eq', '');
    if (error) return [];
    
    const labelCounts = new Map<string, number>();
    data?.forEach(row => { 
      if (row.label) labelCounts.set(row.label, (labelCounts.get(row.label) || 0) + 1);
    });
    return Array.from(labelCounts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchFormats(): Promise<PickerDataItem[]> {
  try {
    const { data: v3Data, error: v3Error } = await supabase
      .from('releases')
      .select('format')
      .not('format', 'is', null)
      .not('format', 'eq', '');
    if (v3Error) return [];
    const formatCounts = new Map<string, number>();
    v3Data?.forEach(row => { if (row.format) formatCounts.set(row.format, (formatCounts.get(row.format) || 0) + 1); });
    return Array.from(formatCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
    if (error) return [];
    const formatCounts = new Map<string, number>();
    data?.forEach(row => {
      const values = new Set<string>();
      if (row.media_type) values.add(row.media_type);
      if (Array.isArray(row.format_details)) {
        row.format_details.forEach(detail => { if (detail) values.add(detail); });
      }
      values.forEach(value => formatCounts.set(value, (formatCounts.get(value) || 0) + 1));
    });
    return Array.from(formatCounts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchGenres(): Promise<PickerDataItem[]> {
  try {
    const { data: v3Data, error: v3Error } = await supabase
      .from('masters')
      .select('genres')
      .not('genres', 'is', null);
    if (v3Error) return [];
    const genreCounts = new Map<string, number>();
    v3Data?.forEach(row => {
      const allGenres = Array.isArray(row.genres) ? row.genres : [];
      allGenres.forEach(genre => { if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1); });
    });
    return Array.from(genreCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchLocations(): Promise<PickerDataItem[]> {
  try {
    const { data: v3Data, error: v3Error } = await supabase
      .from('inventory')
      .select('location')
      .not('location', 'is', null)
      .not('location', 'eq', '');
    if (v3Error) return [];
    const locationCounts = new Map<string, number>();
    v3Data?.forEach(row => { if (row.location) locationCounts.set(row.location, (locationCounts.get(row.location) || 0) + 1); });
    return Array.from(locationCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchArtists(): Promise<PickerDataItem[]> {
  try {
    const { data: v3Data, error: v3Error } = await supabase
      .from('artists')
      .select('name, sort_name')
      .not('name', 'is', null)
      .not('name', 'eq', '');
    if (v3Error) return [];
    const artistMap = new Map<string, { count: number; sortName: string }>();
    v3Data?.forEach(row => {
      if (row.name) {
        const current = artistMap.get(row.name);
        const sortVal = row.sort_name || row.name;
        if (current) {
          current.count++;
          if (current.sortName === row.name && sortVal !== row.name) current.sortName = sortVal;
        } else {
          artistMap.set(row.name, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(artistMap.entries())
      .map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName }))
      .sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch { return []; }
}

export async function fetchMediaConditions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('media_condition')
      .not('media_condition', 'is', null)
      .not('media_condition', 'eq', '');

    if (error) return [];

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.media_condition) {
        counts.set(row.media_condition, (counts.get(row.media_condition) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => {
        const rankA = getGradeRank(a.name);
        const rankB = getGradeRank(b.name);
        if (rankA === rankB) return a.name.localeCompare(b.name);
        return rankA - rankB;
      });
  } catch {
    return [];
  }
}

export async function fetchPackageConditions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('package_sleeve_condition')
      .not('package_sleeve_condition', 'is', null)
      .not('package_sleeve_condition', 'eq', '');

    if (error) return [];

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.sleeve_condition) {
        counts.set(row.sleeve_condition, (counts.get(row.sleeve_condition) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => {
        const rankA = getGradeRank(a.name);
        const rankB = getGradeRank(b.name);
        if (rankA === rankB) return a.name.localeCompare(b.name);
        return rankA - rankB;
      });
  } catch {
    return [];
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function updateLabel(): Promise<boolean> {
  // Global label rename disabled for array schema
  console.warn("Global label rename not supported in array schema yet.");
  return false; 
}

export async function updateFormat(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ format: newName }).eq('format', id); return !error; } catch { return false; }
}

export async function updateLocation(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: newName }).eq('location', id); return !error; } catch { return false; }
}

export async function deleteLocation(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: null }).eq('location', id); return !error; } catch { return false; }
}

export async function updateArtist(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try {
    const updates: { artist: string; sort_artist?: string } = { artist: newName };
    if (newSortName !== undefined) updates.sort_artist = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('artist', id);
    return !error;
  } catch { return false; }
}

export async function deleteArtist(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').delete().eq('artist', id); return !error; } catch { return false; }
}

export async function mergeArtists(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ artist: targetId }).in('artist', sourceIds); return !error; } catch { return false; }
}

export async function deleteLabel(): Promise<boolean> {
  console.warn("Global label delete not supported in array schema yet.");
  return false;
}

export async function mergeLabels(): Promise<boolean> {
  console.warn("Global label merge not supported in array schema yet.");
  return false; 
}

export async function mergeFormats(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ format: targetId }).in('format', sourceIds); return !error; } catch { return false; }
}

export async function mergeLocations(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: targetId }).in('location', sourceIds); return !error; } catch { return false; }
}

// Packaging

export async function fetchPackaging(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('packaging')
      .not('packaging', 'is', null)
      .not('packaging', 'eq', '');
    if (error) return [];
    const packagingCounts = new Map<string, number>();
    data?.forEach(row => { if (row.packaging) packagingCounts.set(row.packaging, (packagingCounts.get(row.packaging) || 0) + 1); });
    return Array.from(packagingCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updatePackaging(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ packaging: newName }).eq('packaging', id); return !error; } catch { return false; }
}

export async function deletePackaging(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ packaging: null }).eq('packaging', id); return !error; } catch { return false; }
}

export async function mergePackaging(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ packaging: targetId }).in('packaging', sourceIds); return !error; } catch { return false; }
}

// Studios

export async function fetchStudios(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('studio')
      .not('studio', 'is', null)
      .not('studio', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.studio) counts.set(row.studio, (counts.get(row.studio) || 0) + 1); });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updateStudio(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ studio: newName }).eq('studio', id); return !error; } catch { return false; }
}

export async function mergeStudios(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ studio: targetId }).in('studio', sourceIds); return !error; } catch { return false; }
}

// Countries

export async function fetchCountries(): Promise<PickerDataItem[]> {
  const standardCountries = ['US', 'UK', 'Canada', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria', 'Switzerland', 'Japan', 'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Russia', 'Poland', 'Czech Republic', 'Hungary', 'Portugal', 'Greece', 'Ireland', 'Israel', 'South Korea', 'China', 'India', 'Europe', 'UK & Europe', 'USA & Canada'];
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('country')
      .not('country', 'is', null)
      .not('country', 'eq', '');
    if (error) throw error;
    const countryCounts = new Map<string, number>();
    data?.forEach(row => { if (row.country) countryCounts.set(row.country, (countryCounts.get(row.country) || 0) + 1); });
    const allCountries = new Set([...standardCountries, ...countryCounts.keys()]);
    return Array.from(allCountries)
      .map(name => ({ id: name, name, count: countryCounts.get(name) || 0 }))
      .sort((a, b) => (a.name === 'US' ? -1 : b.name === 'US' ? 1 : a.name.localeCompare(b.name)));
  } catch {
    return standardCountries.map(name => ({ id: name, name, count: 0 }))
      .sort((a, b) => (a.name === 'US' ? -1 : b.name === 'US' ? 1 : a.name.localeCompare(b.name)));
  }
}

// Sounds

export async function fetchSounds(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('sound')
      .not('sound', 'is', null)
      .not('sound', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.sound) counts.set(row.sound, (counts.get(row.sound) || 0) + 1); });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updateSound(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ sound: newName }).eq('sound', id); return !error; } catch { return false; }
}

export async function mergeSounds(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ sound: targetId }).in('sound', sourceIds); return !error; } catch { return false; }
}

// Vinyl Colors

export async function fetchVinylColors(): Promise<PickerDataItem[]> {
  const standardColors = ['Black', 'Red', 'Blue', 'Yellow', 'Orange', 'Green', 'Purple', 'Pink', 'White', 'Transparent', 'Brown', 'Gold', 'Metallic', 'Marbled', 'Swirl', 'Glow-in-the-Dark', 'Picture', 'Color-in-Color', 'Starburst', 'Splatter', 'Liquid-Filled'];
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('vinyl_color')
      .not('vinyl_color', 'is', null);
    if (error) throw error;
    const counts = new Map<string, number>();
    data?.forEach(row => { 
      if (row.vinyl_color) {
        const colors = Array.isArray(row.vinyl_color) ? row.vinyl_color : [row.vinyl_color];
        colors.forEach((c: string) => { if (c) counts.set(c, (counts.get(c) || 0) + 1); }); 
      }
    });
    return Array.from(new Set([...standardColors, ...counts.keys()]))
      .map(name => ({ id: name, name, count: counts.get(name) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return standardColors.map(name => ({ id: name, name, count: 0 })); }
}

export async function updateVinylColor(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ vinyl_color: newName }).eq('vinyl_color', id); return !error; } catch { return false; }
}

export async function mergeVinylColors(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ vinyl_color: targetId }).in('vinyl_color', sourceIds); return !error; } catch { return false; }
}

// Vinyl Weights

export async function fetchVinylWeights(): Promise<PickerDataItem[]> {
  const standardWeights = ['80 gram vinyl', '100 gram vinyl', '120 gram vinyl', '140 gram vinyl', '160 gram vinyl', '180 gram vinyl', '200 gram vinyl'];
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('vinyl_weight')
      .not('vinyl_weight', 'is', null)
      .not('vinyl_weight', 'eq', '');
    if (error) throw error;
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.vinyl_weight) counts.set(row.vinyl_weight, (counts.get(row.vinyl_weight) || 0) + 1); });
    return Array.from(new Set([...standardWeights, ...counts.keys()]))
      .map(name => ({ id: name, name, count: counts.get(name) || 0 }))
      .sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0));
  } catch { return standardWeights.map(name => ({ id: name, name, count: 0 })); }
}

// SPARS

export async function fetchSPARS(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('spars_code')
      .not('spars_code', 'is', null)
      .not('spars_code', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.spars_code) counts.set(row.spars_code, (counts.get(row.spars_code) || 0) + 1); });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updateSPARS(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ spars_code: newName }).eq('spars_code', id); return !error; } catch { return false; }
}

export async function mergeSPARS(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ spars_code: targetId }).in('spars_code', sourceIds); return !error; } catch { return false; }
}

// Box Sets

export async function fetchBoxSets(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('box_set').not('box_set', 'is', null).not('box_set', 'eq', '');
    if (error) return [];
    const boxSetCounts = new Map<string, number>();
    data?.forEach(row => { if (row.box_set) boxSetCounts.set(row.box_set, (boxSetCounts.get(row.box_set) || 0) + 1); });
    return Array.from(boxSetCounts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

// Purchase Stores

export async function fetchPurchaseStores(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('purchase_store').not('purchase_store', 'is', null).not('purchase_store', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.purchase_store) counts.set(row.purchase_store, (counts.get(row.purchase_store) || 0) + 1); });
    return Array.from(counts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updatePurchaseStore(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ purchase_store: newName }).eq('purchase_store', id); return !error; } catch { return false; }
}

export async function deletePurchaseStore(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ purchase_store: null }).eq('purchase_store', id); return !error; } catch { return false; }
}

export async function mergePurchaseStores(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ purchase_store: targetId }).in('purchase_store', sourceIds); return !error; } catch { return false; }
}

// Owners

export async function fetchOwners(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('owner').not('owner', 'is', null).not('owner', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.owner) counts.set(row.owner, (counts.get(row.owner) || 0) + 1); });
    return Array.from(counts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updateOwner(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ owner: newName }).eq('owner', id); return !error; } catch { return false; }
}

export async function deleteOwner(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ owner: null }).eq('owner', id); return !error; } catch { return false; }
}

export async function mergeOwners(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ owner: targetId }).in('owner', sourceIds); return !error; } catch { return false; }
}

// Signees

export async function fetchSignees(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('signed_by').not('signed_by', 'is', null);
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { 
      if (row.signed_by) {
        const signees = Array.isArray(row.signed_by) ? row.signed_by : [row.signed_by];
        signees.forEach((c: string) => { if(c) counts.set(c, (counts.get(c)||0)+1); }); 
      }
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

// Tags

export async function fetchTags(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('custom_tags').not('custom_tags', 'is', null);
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { 
      if (row.custom_tags) {
        const tags = Array.isArray(row.custom_tags) ? row.custom_tags : [row.custom_tags];
        tags.forEach((c: string) => { if(c) counts.set(c, (counts.get(c)||0)+1); }); 
      }
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

// Composers

export async function fetchComposers(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('composer, sort_composer').not('composer', 'is', null).not('composer', 'eq', '');
    if (error) return [];
    const map = new Map<string, { count: number; sortName: string }>();
    data?.forEach(row => {
      if (row.composer) {
        const current = map.get(row.composer);
        const sortVal = row.sort_composer || row.composer;
        if (current) {
          current.count++;
          if (current.sortName === row.composer && sortVal !== row.composer) current.sortName = sortVal;
        } else {
          map.set(row.composer, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(map.entries())
      .map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName }))
      .sort((a, b) => {
        const sa = a.sortName || a.name;
        const sb = b.sortName || b.name;
        return sa.localeCompare(sb);
      });
  } catch { return []; }
}

export async function updateComposer(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try {
    const updates: { composer: string; sort_composer?: string } = { composer: newName };
    if (newSortName !== undefined) updates.sort_composer = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('composer', id);
    if (error) { console.error(error); return false; }
    return true; 
  } catch { return false; }
}

export async function mergeComposers(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ composer: targetId }).in('composer', sourceIds); if (error) { console.error(error); return false; } return true; } catch { return false; }
}

// Conductors

export async function fetchConductors(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('conductor, sort_conductor').not('conductor', 'is', null).not('conductor', 'eq', '');
    if (error) return [];
    const map = new Map<string, { count: number; sortName: string }>();
    data?.forEach(row => {
      if (row.conductor) {
        const current = map.get(row.conductor);
        const sortVal = row.sort_conductor || row.conductor;
        if (current) {
          current.count++;
          if (current.sortName === row.conductor && sortVal !== row.conductor) current.sortName = sortVal;
        } else {
          map.set(row.conductor, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(map.entries()).map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName })).sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch { return []; }
}

export async function updateConductor(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try { 
    const updates: { conductor: string; sort_conductor?: string } = { conductor: newName };
    if (newSortName !== undefined) updates.sort_conductor = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('conductor', id); 
    if (error) { console.error(error); return false; }
    return true; 
  } catch { return false; }
}

export async function mergeConductors(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ conductor: targetId }).in('conductor', sourceIds); if (error) { console.error(error); return false; } return true; } catch { return false; }
}

// Choruses

export async function fetchChoruses(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('chorus, sort_chorus').not('chorus', 'is', null).not('chorus', 'eq', '');
    if (error) return [];
    const map = new Map<string, { count: number; sortName: string }>();
    data?.forEach(row => {
      if (row.chorus) {
        const current = map.get(row.chorus);
        const sortVal = row.sort_chorus || row.chorus;
        if (current) {
          current.count++;
          if (current.sortName === row.chorus && sortVal !== row.chorus) current.sortName = sortVal;
        } else {
          map.set(row.chorus, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(map.entries()).map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName })).sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch { return []; }
}

export async function updateChorus(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try { 
    const updates: { chorus: string; sort_chorus?: string } = { chorus: newName };
    if (newSortName !== undefined) updates.sort_chorus = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('chorus', id); 
    if (error) { console.error(error); return false; }
    return true; 
  } catch { return false; }
}

export async function mergeChorus(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ chorus: targetId }).in('chorus', sourceIds); if (error) { console.error(error); return false; } return true; } catch { return false; }
}

// Compositions

export async function fetchCompositions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('composition, sort_composition').not('composition', 'is', null).not('composition', 'eq', '');
    if (error) return [];
    const map = new Map<string, { count: number; sortName: string }>();
    data?.forEach(row => {
      if (row.composition) {
        const current = map.get(row.composition);
        const sortVal = row.sort_composition || row.composition;
        if (current) {
          current.count++;
          if (current.sortName === row.composition && sortVal !== row.composition) current.sortName = sortVal;
        } else {
          map.set(row.composition, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(map.entries()).map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName })).sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch { return []; }
}

export async function updateComposition(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try { 
    const updates: { composition: string; sort_composition?: string } = { composition: newName };
    if (newSortName !== undefined) updates.sort_composition = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('composition', id); 
    if (error) { console.error(error); return false; }
    return true; 
  } catch { return false; }
}

export async function mergeCompositions(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ composition: targetId }).in('composition', sourceIds); if (error) { console.error(error); return false; } return true; } catch { return false; }
}

// Orchestras

export async function fetchOrchestras(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('collection_v2_archive').select('orchestra, sort_orchestra').not('orchestra', 'is', null).not('orchestra', 'eq', '');
    if (error) return [];
    const map = new Map<string, { count: number; sortName: string }>();
    data?.forEach(row => {
      if (row.orchestra) {
        const current = map.get(row.orchestra);
        const sortVal = row.sort_orchestra || row.orchestra;
        if (current) {
          current.count++;
          if (current.sortName === row.orchestra && sortVal !== row.orchestra) current.sortName = sortVal;
        } else {
          map.set(row.orchestra, { count: 1, sortName: sortVal });
        }
      }
    });
    return Array.from(map.entries()).map(([name, info]) => ({ id: name, name, count: info.count, sortName: info.sortName })).sort((a, b) => (a.sortName || a.name).localeCompare(b.sortName || b.name));
  } catch { return []; }
}

export async function updateOrchestra(id: string, newName: string, newSortName?: string): Promise<boolean> {
  try { 
    const updates: { orchestra: string; sort_orchestra?: string } = { orchestra: newName };
    if (newSortName !== undefined) updates.sort_orchestra = newSortName;
    const { error } = await supabase.from('collection_v2_archive').update(updates).eq('orchestra', id); 
    if (error) { console.error(error); return false; }
    return true; 
  } catch { return false; }
}

export async function mergeOrchestras(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('collection_v2_archive').update({ orchestra: targetId }).in('orchestra', sourceIds); if (error) { console.error(error); return false; } return true; } catch { return false; }
}

// ============================================================================
// SMART LISTS EXPORTS (Musicians, Songwriters, Producers, Engineers)
// Now fully enabled for Sort Name + Edit/Merge/Delete
// ============================================================================

// Musicians
export async function fetchMusicians(): Promise<PickerDataItem[]> { return fetchSmartList('musicians'); }
export async function updateMusician(id: string, newName: string, newSortName?: string): Promise<boolean> { return updateSmartList('musicians', id, newName, newSortName); }
export async function deleteMusician(id: string): Promise<boolean> { return deleteSmartList('musicians', id); }
export async function mergeMusicians(targetId: string, sourceIds: string[]): Promise<boolean> { return mergeSmartList('musicians', targetId, sourceIds); }

// Songwriters
export async function fetchSongwriters(): Promise<PickerDataItem[]> { return fetchSmartList('songwriters'); }
export async function updateSongwriter(id: string, newName: string, newSortName?: string): Promise<boolean> { return updateSmartList('songwriters', id, newName, newSortName); }
export async function deleteSongwriter(id: string): Promise<boolean> { return deleteSmartList('songwriters', id); }
export async function mergeSongwriters(targetId: string, sourceIds: string[]): Promise<boolean> { return mergeSmartList('songwriters', targetId, sourceIds); }

// Producers
export async function fetchProducers(): Promise<PickerDataItem[]> { return fetchSmartList('producers'); }
export async function updateProducer(id: string, newName: string, newSortName?: string): Promise<boolean> { return updateSmartList('producers', id, newName, newSortName); }
export async function deleteProducer(id: string): Promise<boolean> { return deleteSmartList('producers', id); }
export async function mergeProducers(targetId: string, sourceIds: string[]): Promise<boolean> { return mergeSmartList('producers', targetId, sourceIds); }

// Engineers
export async function fetchEngineers(): Promise<PickerDataItem[]> { return fetchSmartList('engineers'); }
export async function updateEngineer(id: string, newName: string, newSortName?: string): Promise<boolean> { return updateSmartList('engineers', id, newName, newSortName); }
export async function deleteEngineer(id: string): Promise<boolean> { return deleteSmartList('engineers', id); }
export async function mergeEngineers(targetId: string, sourceIds: string[]): Promise<boolean> { return mergeSmartList('engineers', targetId, sourceIds); }
