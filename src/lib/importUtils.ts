// src/lib/importUtils.ts
import { supabase } from './supabaseClient';
import type { Database } from '../types/supabase';

// ============================================================================
// 1. STRING NORMALIZATION (Synchronous)
// ============================================================================

/**
 * Clean artist names by removing Discogs disambiguation numbers.
 * Example: "John Williams (4)" -> "John Williams"
 */
export function cleanArtistName(rawName: string): string {
  if (!rawName) return '';
  // 1. Regex to strip " (2)", " (12)", etc. at the end of the string
  let cleaned = rawName.replace(/\s\(\d+\)$/, '');
  
  // 2. Normalize " and " to " & " for consistency
  cleaned = cleaned.replace(/\s+and\s+/gi, ' & ');
  
  return cleaned.trim();
}

/**
 * Generate a sort name based on rules.
 */
export function generateSortName(name: string, exceptions: string[] = []): string {
  if (!name) return '';
  
  // Check strict exceptions (like "The The")
  if (exceptions.includes(name)) {
    return name;
  }

  // Standard Logic: Move leading "The" to the end
  if (name.match(/^The\s/i)) {
    return name.substring(4) + ', The';
  }
  
  // Standard Logic: Move leading "A" to the end
  if (name.match(/^A\s/i)) {
    return name.substring(2) + ', A';
  }

  return name;
}

/**
 * Extract "Featuring" artists from a string.
 */
export function extractSecondaryArtists(artistString: string): { 
  primary: string; 
  secondary: string[] 
} {
  if (!artistString) return { primary: '', secondary: [] };

  const feats = [' feat. ', ' ft. ', ' featuring ', ' with '];
  let primary = artistString;
  const secondary: string[] = [];

  for (const separator of feats) {
    if (primary.toLowerCase().includes(separator)) {
      const parts = primary.split(new RegExp(separator, 'i'));
      primary = parts[0].trim();
      
      // Split the remainder by commas or & to get individual artists
      if (parts[1]) {
        const guests = parts[1].split(/,|&/).map(s => cleanArtistName(s.trim()));
        secondary.push(...guests);
      }
      break; 
    }
  }

  return { primary: cleanArtistName(primary), secondary };
}

// ============================================================================
// 2. DATABASE LOGIC (Async - The "Brain")
// ============================================================================

/**
 * Check the 'artist_rules' table for aliases.
 * If a rule exists (e.g., "Childish Gambino" -> "Donald Glover"), return the replacement.
 */
export async function resolveArtistAlias(artistName: string): Promise<string> {
  const cleaned = cleanArtistName(artistName);
  
  const { data, error } = await supabase
    .from('artist_rules')
    .select('replacement')
    .eq('search_pattern', cleaned)
    .eq('rule_type', 'alias')
    .maybeSingle();

  if (error) {
    console.warn(`Error resolving alias for ${cleaned}:`, error);
    return cleaned;
  }

  return data?.replacement || cleaned;
}

/**
 * Ensure tags exist in 'master_tags' and link them to the album in 'collection_tags'.
 */
export async function saveTags(collectionId: number, tags: string[], category: 'genre' | 'style' | 'custom' = 'custom') {
  if (!tags || tags.length === 0) return;

  const validTags = tags.map(t => t.trim()).filter(t => t.length > 0);
  const tagIds: number[] = [];

  // 1. Ensure all tags exist in master_tags
  for (const tagName of validTags) {
    // Try to find existing
    const { data: existing } = await supabase
      .from('master_tags')
      .select('id')
      .ilike('name', tagName)
      .maybeSingle();

    let tagId = existing?.id;

    // Create if missing
    if (!tagId) {
      const { data: created, error } = await supabase
        .from('master_tags')
        .insert({ name: tagName, category })
        .select('id')
        .single();
      
      if (!error && created) {
        tagId = created.id;
      }
    }

    if (tagId) tagIds.push(tagId);
  }

  // 2. Link to collection
  if (tagIds.length > 0) {
    const links = tagIds.map(tagId => ({
      collection_id: collectionId,
      tag_id: tagId
    }));

    // Upsert to avoid duplicates
    await supabase.from('collection_tags').upsert(links, { onConflict: 'collection_id,tag_id' });
  }
}

/**
 * Save BPM and Key data to the 'collection_dj_data' sidecar table.
 */
export async function saveDJData(collectionId: number, bpm?: number, key?: string) {
  if (!bpm && !key) return;

  // Uses strict typing from Database definitions to avoid 'any'
  const updateData: Database['public']['Tables']['collection_dj_data']['Insert'] = { 
    collection_id: collectionId 
  };
  
  if (bpm) updateData.bpm = Math.round(bpm);
  if (key) updateData.musical_key = key;

  const { error } = await supabase
    .from('collection_dj_data')
    .upsert(updateData, { onConflict: 'collection_id' });

  if (error) {
    console.error('Error saving DJ data:', error);
  }
}

// ============================================================================
// COMPATIBILITY LAYER
// ============================================================================

export function normalizeArtist(artist: string): string {
  return cleanArtistName(artist).toLowerCase();
}

export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title.trim().toLowerCase();
}

export function normalizeArtistAlbum(artist: string, album: string): string {
  return `${normalizeArtist(artist)} ${normalizeTitle(album)}`;
}

export type SyncMode = 'full_replacement' | 'full_sync' | 'partial_sync' | 'new_only';

export function isSameAlbum(
  album1: { artist: string; title: string },
  album2: { artist: string; title: string }
): boolean {
  return (
    cleanArtistName(album1.artist).toLowerCase() === cleanArtistName(album2.artist).toLowerCase() &&
    album1.title.toLowerCase() === album2.title.toLowerCase()
  );
}
