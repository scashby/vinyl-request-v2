// src/lib/clzImportWorkflow.ts

/**
 * Comprehensive CLZ Music Web Import Workflow
 * * Complete implementation with database operations for importing CLZ XML data
 */

import { parseCLZXML, clzToCollectionRow } from './clzParser';
import { 
  detectConflicts, 
  getSafeUpdates, 
  findMatchingAlbum, 
  type FieldConflict,
  type CollectionRow
} from './conflictDetection';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    // Parse CLZ XML
    const clzAlbums = await parseCLZXML(xmlContent);
    result.totalProcessed = clzAlbums.length;
    
    if (clzAlbums.length === 0) {
      result.message = 'No albums found in CLZ XML';
      return result;
    }
    
    // Fetch all existing albums for matching
    const { data: existingAlbums, error: fetchError } = await supabase
      .from('collection')
      .select('*');
    
    if (fetchError) {
      throw new Error(`Failed to fetch existing albums: ${fetchError.message}`);
    }
    
    const albumsToInsert: Array<Record<string, unknown>> = [];
    const albumsToUpdate: Array<{ id: number; updates: Record<string, unknown> }> = [];
    const conflicts: FieldConflict[] = [];
    
    // Process each album
    for (const clzData of clzAlbums) {
      try {
        // Find matching album
        const matchingAlbum: CollectionRow | undefined = findMatchingAlbum(clzData, existingAlbums || []);
        
        if (!matchingAlbum) {
          // New album - prepare for insert
          // CHANGED: Pass defaultFolder as "location" fallback if needed, though parser now handles location
          const newAlbum = clzToCollectionRow(clzData, defaultFolder);
          albumsToInsert.push(newAlbum);
          continue;
        }
        
        // Existing album - handle based on update mode
        if (updateMode === 'update_missing_only') {
          // Only update NULL/empty fields
          const safeUpdates = getSafeUpdates(matchingAlbum, clzData, 'clz');
          
          if (Object.keys(safeUpdates).length > 0) {
            albumsToUpdate.push({
              id: matchingAlbum.id,
              updates: safeUpdates
            });
          } else {
            result.skippedAlbums++;
          }
        } else {
          // update_all mode - detect conflicts
          const { conflicts: albumConflicts, safeUpdates } = detectConflicts(
            matchingAlbum,
            clzData,
            'clz',
            []
          );
          
          if (albumConflicts.length > 0) {
            // Has conflicts - add to list for user resolution
            conflicts.push(...albumConflicts);
            result.conflictsDetected++;
          } else if (Object.keys(safeUpdates).length > 0) {
            // No conflicts but has updates - safe to update
            albumsToUpdate.push({
              id: matchingAlbum.id,
              updates: safeUpdates
            });
          } else {
            result.skippedAlbums++;
          }
        }
      } catch (error) {
        result.errors.push({
          album: `${clzData.artist} - ${clzData.title}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // If conflicts detected in update_all mode, return them for user resolution
    if (conflicts.length > 0 && updateMode === 'update_all') {
      result.conflicts = conflicts;
      result.message = `Found ${result.conflictsDetected} albums with conflicts requiring resolution`;
      return result;
    }
    
    // Execute database operations
    
    // Insert new albums
    if (albumsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('collection')
        .insert(albumsToInsert);
      
      if (insertError) {
        throw new Error(`Failed to insert albums: ${insertError.message}`);
      }
      
      result.newAlbums = albumsToInsert.length;
    }
    
    // Update existing albums
    if (albumsToUpdate.length > 0) {
      for (const update of albumsToUpdate) {
        const { error: updateError } = await supabase
          .from('collection')
          .update(update.updates)
          .eq('id', update.id);
        
        if (updateError) {
          result.errors.push({
            album: `Album ID ${update.id}`,
            error: updateError.message
          });
        } else {
          result.updatedAlbums++;
        }
      }
    }
    
    // Record import history
    // CHANGED: Ensure history notes use 'personal_notes' if we were to log detail, 
    // but the 'import_history' table uses a generic 'notes' column which IS correct.
    // The import_history table schema wasn't changed in the refactor, only 'collection'.
    const { error: historyError } = await supabase
      .from('import_history')
      .insert({
        records_added: result.newAlbums,
        records_updated: result.updatedAlbums,
        status: 'completed',
        notes: `CLZ import: ${updateMode} mode. ${result.errors.length} errors.`
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
      // Update collection table with resolved value
      const { error: updateError } = await supabase
        .from('collection')
        .update({ [resolution.field_name]: resolution.resolved_value })
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
    .from('collection')
    .select('*');
  
  const newAlbums: Array<{ artist: string; title: string; format: string }> = [];
  const albumsToUpdate: Array<{ id: number; artist: string; title: string; updateCount: number }> = [];
  const conflicts: FieldConflict[] = [];
  
  for (const clzData of clzAlbums) {
    const matchingAlbum: CollectionRow | undefined = findMatchingAlbum(clzData, existingAlbums || []);
    
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