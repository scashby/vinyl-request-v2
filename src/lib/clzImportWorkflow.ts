// src/lib/clzImportWorkflow.ts

/**
 * Comprehensive CLZ Music Web Import Workflow
 * * Complete implementation with database operations for importing CLZ XML data
 */

import { parseCLZXML } from './clzParser';
import { parseDiscogsFormat } from './formatParser';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type CollectionRow,
  type FieldConflict,
  detectConflicts,
  findMatchingAlbum,
  getSafeUpdates,
} from './conflictDetection';

export type UpdateMode = 'update_missing_only' | 'update_all';

export interface ImportResult {
  success: boolean;
  totalProcessed: number;
  newAlbums: number;
  updatedAlbums: number;
  conflictsDetected: number;
  conflicts?: FieldConflict[];
  skippedAlbums: number;
  errors: Array<{ album: string; error: string }>;
  message: string;
}

type ArtistRow = { id: number };
type MasterRow = { id: number };
type ReleaseRow = { id: number };
type InventoryRow = { id: number };

const normalizeText = (value?: string | null) => (value ?? '').trim();

async function getOrCreateArtist(
  supabase: SupabaseClient,
  name: string
): Promise<{ row: ArtistRow; created: boolean }> {
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (existing) return { row: existing, created: false };

  const { data: created, error } = await supabase
    .from('artists')
    .insert({ name })
    .select('id')
    .single();

  if (error || !created) throw error;
  return { row: created, created: true };
}

async function getOrCreateMaster(
  supabase: SupabaseClient,
  artistId: number,
  title: string,
  year?: string
): Promise<{ row: MasterRow; created: boolean }> {
  const { data: existing } = await supabase
    .from('masters')
    .select('id')
    .eq('title', title)
    .eq('main_artist_id', artistId)
    .maybeSingle();

  if (existing) return { row: existing, created: false };

  const { data: created, error } = await supabase
    .from('masters')
    .insert({
      title,
      main_artist_id: artistId,
      original_release_year: year ? Number(year) : null,
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return { row: created, created: true };
}

async function getOrCreateRelease(
  supabase: SupabaseClient,
  masterId: number,
  data: {
    media_type?: string;
    format_details?: string[] | null;
    qty?: number | null;
    label?: string;
    cat_no?: string;
    barcode?: string;
    country?: string;
    year?: string;
  }
): Promise<{ row: ReleaseRow; created: boolean }> {
  const catalogNumber = normalizeText(data.cat_no);
  const mediaType = normalizeText(data.media_type) || 'Unknown';

  const query = supabase
    .from('releases')
    .select('id')
    .eq('master_id', masterId);

  const { data: existing } = catalogNumber
    ? await query.eq('catalog_number', catalogNumber).maybeSingle()
    : await query.eq('media_type', mediaType).maybeSingle();

  if (existing) return { row: existing, created: false };

  const { data: created, error } = await supabase
    .from('releases')
    .insert({
      master_id: masterId,
      media_type: mediaType,
      format_details: data.format_details ?? null,
      qty: data.qty ?? null,
      label: data.label ?? null,
      catalog_number: catalogNumber || null,
      barcode: data.barcode ?? null,
      country: data.country ?? null,
      release_year: data.year ? Number(data.year) : null,
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return { row: created, created: true };
}

async function getOrCreateInventory(
  supabase: SupabaseClient,
  releaseId: number,
  data: {
    location?: string;
    media_condition?: string;
    sleeve_condition?: string;
    personal_notes?: string;
    collection_status?: string;
  }
): Promise<{ row: InventoryRow; created: boolean }> {
  const { data: existing } = await supabase
    .from('inventory')
    .select('id')
    .eq('release_id', releaseId)
    .maybeSingle();

  if (existing) return { row: existing, created: false };

  const status =
    data.collection_status === 'wishlist'
      ? 'wishlist'
      : data.collection_status === 'incoming'
        ? 'incoming'
        : data.collection_status === 'sold'
          ? 'sold'
          : data.collection_status === 'for_sale'
            ? 'for_sale'
            : 'in_collection';

  const { data: created, error } = await supabase
    .from('inventory')
    .insert({
      release_id: releaseId,
      status,
      location: data.location ?? null,
      media_condition: data.media_condition ?? null,
      sleeve_condition: data.sleeve_condition ?? null,
      personal_notes: data.personal_notes ?? null,
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return { row: created, created: true };
}

/**
 * Complete CLZ import - handles database operations
 */
export async function importCLZData(
  supabase: SupabaseClient,
  xmlContent: string,
  updateMode: UpdateMode,
  defaultFolder: string = 'All Albums'
): Promise<ImportResult> {
  
  const result: ImportResult = {
    success: false,
    totalProcessed: 0,
    newAlbums: 0,
    updatedAlbums: 0,
    conflictsDetected: 0,
    skippedAlbums: 0,
    errors: [],
    message: ''
  };
  
  try {
    const clzAlbums = await parseCLZXML(xmlContent);
    result.totalProcessed = clzAlbums.length;

    if (clzAlbums.length === 0) {
      result.message = 'No albums found in CLZ XML';
      return result;
    }

    for (const clzData of clzAlbums) {
      try {
        const artistName = normalizeText(clzData.artist) || 'Unknown Artist';
        const title = normalizeText(clzData.title) || 'Untitled';
        const parsedFormat = parseDiscogsFormat(clzData.format ?? '');

        const { row: artistRow } = await getOrCreateArtist(supabase, artistName);
        const { row: masterRow, created: masterCreated } = await getOrCreateMaster(
          supabase,
          artistRow.id,
          title,
          clzData.year
        );

        const { row: releaseRow, created: releaseCreated } = await getOrCreateRelease(
          supabase,
          masterRow.id,
          {
            media_type: parsedFormat.media_type,
            format_details: parsedFormat.format_details,
            qty: parsedFormat.qty,
            label: clzData.labels?.[0],
            cat_no: clzData.cat_no,
            barcode: clzData.barcode,
            country: clzData.country,
            year: clzData.year,
          }
        );

        const { row: inventoryRow, created: inventoryCreated } = await getOrCreateInventory(
          supabase,
          releaseRow.id,
          {
            location: clzData.location || defaultFolder,
            media_condition: clzData.media_condition,
            sleeve_condition: clzData.package_sleeve_condition,
            personal_notes: clzData.personal_notes,
            collection_status: clzData.collection_status,
          }
        );

        if (masterCreated || releaseCreated || inventoryCreated) {
          result.newAlbums++;
        } else if (updateMode === 'update_all') {
          const masterUpdate = {
            title,
            original_release_year: clzData.year ? Number(clzData.year) : null,
            genres: clzData.clz_genres ?? null,
          };
          await supabase.from('masters').update(masterUpdate).eq('id', masterRow.id);

          const releaseUpdate = {
            media_type: parsedFormat.media_type ?? 'Unknown',
            format_details: parsedFormat.format_details ?? null,
            qty: parsedFormat.qty ?? null,
            label: clzData.labels?.[0] ?? null,
            catalog_number: clzData.cat_no ?? null,
            barcode: clzData.barcode ?? null,
            country: clzData.country ?? null,
            release_year: clzData.year ? Number(clzData.year) : null,
          };
          await supabase.from('releases').update(releaseUpdate).eq('id', releaseRow.id);

          const inventoryUpdate = {
            location: clzData.location || defaultFolder,
            media_condition: clzData.media_condition ?? null,
            sleeve_condition: clzData.package_sleeve_condition ?? null,
            personal_notes: clzData.personal_notes ?? null,
          };
          await supabase.from('inventory').update(inventoryUpdate).eq('id', inventoryRow.id);

          result.updatedAlbums++;
        } else {
          result.skippedAlbums++;
        }
      } catch (error) {
        result.errors.push({
          album: `${clzData.artist} - ${clzData.title}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const { error: historyError } = await supabase
      .from('import_history')
      .insert({
        records_added: result.newAlbums,
        records_updated: result.updatedAlbums,
        status: 'completed',
        notes: `CLZ import: ${updateMode} mode. ${result.errors.length} errors.`,
      });

    if (historyError) {
      console.error('Failed to record import history:', historyError);
    }

    result.success = true;
    result.message = `Successfully imported ${result.newAlbums} new albums and updated ${result.updatedAlbums} existing albums`;

    if (result.errors.length > 0) {
      result.message += `. ${result.errors.length} errors occurred.`;
    }

    return result;
  } catch (error) {
    result.success = false;
    result.message = `CLZ import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    return result;
  }
}

/**
 * Apply conflict resolutions and update database
 */
export async function applyConflictResolutions(
  supabase: SupabaseClient,
  resolutions: Array<{
    album_id: number;
    field_name: string;
    resolution: 'keep_current' | 'use_new' | 'merge';
    resolved_value: unknown;
    current_value: unknown;
    new_value: unknown;
  }>
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;
  
  for (const resolution of resolutions) {
    try {
      const field = resolution.field_name;
      const targetTable =
        ['location', 'personal_notes', 'media_condition', 'sleeve_condition', 'status'].includes(field)
          ? 'inventory'
          : ['media_type', 'label', 'catalog_number', 'barcode', 'country', 'release_year'].includes(field)
            ? 'releases'
            : 'masters';

      const { error: updateError } = await supabase
        .from(targetTable)
        .update({ [field]: resolution.resolved_value })
        .eq('id', resolution.album_id);
      
      if (updateError) {
        errors.push(`Album ${resolution.album_id}: ${updateError.message}`);
        continue;
      }
      
      // Save resolution to history
      const { error: historyError } = await supabase
        .from('import_conflict_resolutions')
        .upsert({
          album_id: resolution.album_id,
          field_name: resolution.field_name,
          kept_value: resolution.resolution === 'keep_current' ? resolution.current_value : resolution.resolved_value,
          rejected_value: resolution.resolution === 'keep_current' ? resolution.new_value : resolution.current_value,
          resolution: resolution.resolution,
          source: 'clz'
        }, {
          onConflict: 'album_id,field_name,source'
        });
      
      if (historyError) {
        console.error('Failed to save resolution history:', historyError);
      }
      
      updated++;
    } catch (error) {
      errors.push(`Album ${resolution.album_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    updated,
    errors
  };
}

/**
 * Get preview of import (what would be changed) without executing
 */
export async function previewCLZImport(
  supabase: SupabaseClient,
  xmlContent: string,
  updateMode: UpdateMode
): Promise<{
  newAlbums: Array<{ artist: string; title: string; format: string }>;
  albumsToUpdate: Array<{ id: number; artist: string; title: string; updateCount: number }>;
  conflicts: FieldConflict[];
}> {
  // Parse CLZ XML
  const clzAlbums = await parseCLZXML(xmlContent);
  
  // Fetch existing albums
  const { data: existingAlbums } = await supabase
    .from('inventory')
    .select(`
      id,
      location,
      media_condition,
      release:releases (
        id,
        media_type,
        format_details,
        qty,
        master:masters (
          title,
          artist:artists ( name )
        )
      )
    `);

  const newAlbums: Array<{ artist: string; title: string; format: string }> = [];
  const albumsToUpdate: Array<{ id: number; artist: string; title: string; updateCount: number }> = [];
  const conflicts: FieldConflict[] = [];

  const buildFormatLabel = (release?: { media_type?: string | null; format_details?: string[] | null; qty?: number | null } | null) => {
    if (!release) return '';
    const parts = [release.media_type, ...(release.format_details ?? [])].filter(Boolean);
    const base = parts.join(', ');
    const qty = release.qty ?? 1;
    if (!base) return '';
    return qty > 1 ? `${qty}x${base}` : base;
  };
  
  const normalizedExisting = (existingAlbums ?? []).map((row) => {
    const release = row.release as { media_type?: string | null; format_details?: string[] | null; qty?: number | null; master?: { title?: string | null; artist?: { name?: string | null } | null } | null } | null;
    const master = release?.master;
    return {
      id: row.id as number,
      artist: master?.artist?.name ?? 'Unknown Artist',
      title: master?.title ?? 'Untitled',
      format: buildFormatLabel(release),
      location: (row as { location?: string | null }).location ?? '',
      media_condition: (row as { media_condition?: string | null }).media_condition ?? '',
      discs: release?.qty ?? 1,
    };
  });

  for (const clzData of clzAlbums) {
    const matchingAlbum: CollectionRow | undefined = findMatchingAlbum(clzData, normalizedExisting);
    
    if (!matchingAlbum) {
      newAlbums.push({
        artist: clzData.artist,
        title: clzData.title,
        format: clzData.format
      });
    } else {
      if (updateMode === 'update_missing_only') {
        const safeUpdates = getSafeUpdates(matchingAlbum, clzData, 'clz');
        if (Object.keys(safeUpdates).length > 0) {
          albumsToUpdate.push({
            id: matchingAlbum.id,
            artist: matchingAlbum.artist,
            title: matchingAlbum.title,
            updateCount: Object.keys(safeUpdates).length
          });
        }
      } else {
        const { conflicts: albumConflicts, safeUpdates } = detectConflicts(
          matchingAlbum,
          clzData,
          'clz',
          []
        );
        
        if (albumConflicts.length > 0) {
          conflicts.push(...albumConflicts);
        } else if (Object.keys(safeUpdates).length > 0) {
          albumsToUpdate.push({
            id: matchingAlbum.id,
            artist: matchingAlbum.artist,
            title: matchingAlbum.title,
            updateCount: Object.keys(safeUpdates).length
          });
        }
      }
    }
  }
  
  return { newAlbums, albumsToUpdate, conflicts };
}
