// src/app/edit-collection/components/ImportEnrichModal.tsx
/* * ----------------------------------------------------------------------------
 * MODEL INSTRUCTION: DO NOT REMOVE OR CONSOLIDATE CODE WITHOUT APPROVAL.
 * KEEP DEBUGGING LOGS AND EXPANDED CONFIGURATION OBJECTS.
 * ----------------------------------------------------------------------------
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';
import EnrichmentReviewModal from './EnrichmentReviewModal';
import { type FieldConflict } from 'lib/conflictDetection';
import { 
  type DataCategory, 
  DATA_CATEGORY_CHECK_FIELDS, 
  FIELD_TO_SERVICES,
  SERVICE_ICONS,
  DATA_CATEGORY_LABELS,
  DATA_CATEGORY_ICONS
} from 'lib/enrichment-data-mapping';
import styles from '../EditCollection.module.css';

const ALLOWED_COLUMNS = new Set([
  'artist', 'title', 'year', 'format', 'country', 'barcode', 'labels', 'cat_no',
  'tracklists', 'tracklist', 'tracks', 'disc_metadata', 
  'image_url', 'back_image_url', 'sell_price', 'media_condition', 'folder',
  'discogs_master_id', 'discogs_release_id', 'spotify_id', 'spotify_url',
  'apple_music_id', 'apple_music_url', 'lastfm_id', 'lastfm_url', 
  'musicbrainz_id', 'musicbrainz_url', 'wikipedia_url', 'genius_url', 
  'lastfm_tags', 'notes', 'genres', 'styles', 'original_release_date',
  'inner_sleeve_images', 'musicians', 'credits', 'producers', 'engineers', 
  'songwriters', 'composer', 'conductor', 'orchestra',
  'tempo_bpm', 'musical_key', 'lyrics', 'time_signature', 
  'danceability', 'energy', 'mood_acoustic', 'mood_happy', 'mood_sad',
  'mood_aggressive', 'mood_electronic', 'mood_party', 'mood_relaxed'
]);

// --- 2. TYPES ---
interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

// Map: FieldName -> Set of Allowed Service IDs
export type FieldConfigMap = Record<string, Set<string>>;

type EnrichmentStats = {
  total: number;
  needsEnrichment: number;
  fullyEnriched: number;
  missingArtwork: number;
  missingBackCover: number;
  missingSpine?: number;
  missingInnerSleeve?: number;
  missingVinylLabel?: number;
  missingCredits: number;
  missingMusicians: number;
  missingProducers: number;
  missingEngineers?: number;
  missingSongwriters?: number;
  missingTracklists: number;
  missingDurations?: number; // New Type
  missingAudioAnalysis: number;
  missingTempo: number;
  missingMusicalKey?: number;
  missingDanceability?: number;
  missingEnergy?: number;
  missingGenres: number;
  missingStyles?: number;
  missingStreamingLinks: number;
  missingSpotify: number;
  missingAppleMusic?: number;
  missingLastFM?: number;
  missingReleaseMetadata: number;
  missingBarcode?: number;
  missingLabels?: number;
  missingOriginalDate?: number;
  missingCatalogNumber: number;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
  finalized_fields?: string[];
  last_reviewed_at?: string;
  [key: string]: unknown; // Allows dynamic access like album[key]
};

interface CandidateResult {
  album: Record<string, unknown> & { 
    id: number; 
    artist: string; 
    title: string; 
    finalized_fields?: string[]; 
  };
  candidates: Record<string, unknown>;
}

type LogEntry = {
  id: string;
  album: string;
  action: 'auto-fill' | 'conflict-resolved' | 'skipped' | 'info';
  details: string;
  timestamp: Date;
};

// Local interface for resolution history
interface ResolutionHistory {
  album_id: number;
  field_name: string;
  source: string;
}

// Extended type for Multi-Source Conflicts
export type ExtendedFieldConflict = FieldConflict & {
  source: string;
  candidates?: Record<string, unknown>; // map of source -> value
  existing_finalized?: string[];
};

// Helper to normalize values for comparison
const normalizeValue = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return JSON.stringify(val.sort());
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val).trim();
};

const areValuesEqual = (a: unknown, b: unknown): boolean => {
  return normalizeValue(a) === normalizeValue(b);
};

// Helper to validate Postgres dates
const isValidDate = (dateStr: unknown): boolean => {
  if (typeof dateStr !== 'string') return false;
  // Strict check for YYYY-MM-DD.
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
};

// --- 3. MAIN COMPONENT ---
export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [batchSize, setBatchSize] = useState('25');
  
  // Granular Configuration State
  // Map: FieldName -> Set of Allowed Service IDs
  // If a field is present in this object, it is enabled. The Set contains its allowed sources.
  
  
  const [fieldConfig, setFieldConfig] = useState<FieldConfigMap>({});

  // Initialize Default State on Load
  useEffect(() => {
    if (isOpen) {
      const initialConfig: FieldConfigMap = {};
      // Default enabled categories
      const defaultCats: DataCategory[] = ['artwork', 'credits', 'tracklists', 'genres', 'sonic_domain'];
      
      defaultCats.forEach(cat => {
        const fields = DATA_CATEGORY_CHECK_FIELDS[cat] || [];
        fields.forEach(field => {
          if (ALLOWED_COLUMNS.has(field)) {
            const services = FIELD_TO_SERVICES[field] || [];
            if (services.length > 0) {
              initialConfig[field] = new Set(services);
            }
          }
        });
      });
      setFieldConfig(initialConfig);
    }
  }, [isOpen]);
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  const [showReview, setShowReview] = useState(false);
  const [conflicts, setConflicts] = useState<ExtendedFieldConflict[]>([]);
  const [sessionLog, setSessionLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
// NEW: State for the Audit Summary after a batch is saved
  const [batchSummary, setBatchSummary] = useState<{album: string, field: string, action: string}[] | null>(null);

  // Loop Control Refs
  const hasMoreRef = useRef(true);
  const isLoopingRef = useRef(false);
  const cursorRef = useRef(0); // Tracks current position in DB

  useEffect(() => {
    if (isOpen) loadStats();
  }, [isOpen]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionLog]);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await fetch('/api/enrich-sources/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  function getServicesForSelection() {
    // Calculate which services are needed based on the enabled fields
    const activeServices = new Set<string>();
    
    Object.values(fieldConfig).forEach(allowedSources => {
      allowedSources.forEach(s => activeServices.add(s));
    });

    return {
      musicbrainz: activeServices.has('musicbrainz'),
      spotify: activeServices.has('spotify'),
      discogs: activeServices.has('discogs'),
      lastfm: activeServices.has('lastfm'),
      appleMusicEnhanced: activeServices.has('appleMusic'),
      wikipedia: activeServices.has('wikipedia'),
      genius: activeServices.has('genius'),
      coverArt: activeServices.has('coverArtArchive'),
    };
  }

  const toggleField = (field: string) => {
    setFieldConfig(prev => {
      const next = { ...prev };
      if (next[field]) {
        delete next[field];
      } else {
        const defaults = FIELD_TO_SERVICES[field] || [];
        next[field] = new Set(defaults);
      }
      return next;
    });
  };

  const toggleFieldSource = (field: string, service: string) => {
    setFieldConfig(prev => {
      if (!prev[field]) return prev;
      const nextSources = new Set(prev[field]);
      if (nextSources.has(service)) nextSources.delete(service);
      else nextSources.add(service);
      return { ...prev, [field]: nextSources };
    });
  };

  const toggleCategory = (category: DataCategory) => {
    const fields = DATA_CATEGORY_CHECK_FIELDS[category] || [];
    const validFields = fields.filter(f => ALLOWED_COLUMNS.has(f));
    const allEnabled = validFields.every(f => !!fieldConfig[f]);

    setFieldConfig(prev => {
      const next = { ...prev };
      validFields.forEach(f => {
        if (allEnabled) {
          delete next[f];
        } else {
          const defaults = FIELD_TO_SERVICES[f] || [];
          next[f] = new Set(defaults);
        }
      });
      return next;
    });
  };

  function addLog(album: string, action: LogEntry['action'], details: string) {
    setSessionLog(prev => [...prev, {
      id: Math.random().toString(36),
      album,
      action,
      details,
      timestamp: new Date()
    }]);
  }

  // --- MAIN LOOP LOGIC ---

  async function startEnrichment(specificAlbumIds?: number[]) {
    if (Object.keys(fieldConfig).length === 0) {
      alert('Please select at least one field to enrich');
      return;
    }

    hasMoreRef.current = true;
    isLoopingRef.current = true;
    cursorRef.current = 0; 
    setConflicts([]);
    
    if (specificAlbumIds && specificAlbumIds.length > 0) {
      isLoopingRef.current = false;
    }

    await runScanLoop(specificAlbumIds);
  }

  async function runScanLoop(specificAlbumIds?: number[]) {
    if (!hasMoreRef.current && !specificAlbumIds) {
      setStatus('Collection scan complete.');
      setEnriching(false);
      isLoopingRef.current = false;
      return;
    }

    setEnriching(true);
    const targetConflicts = parseInt(batchSize);
    let collectedConflicts: ExtendedFieldConflict[] = [];
    let collectedSummary: {album: string, field: string, action: string}[] = [];

    while ((collectedConflicts.length < targetConflicts || specificAlbumIds) && hasMoreRef.current) {
      setStatus(`Scanning (Cursor: ${cursorRef.current})... Found ${collectedConflicts.length}/${targetConflicts} conflicts.`);

      try {
        const payload = {
          albumIds: specificAlbumIds,
          limit: specificAlbumIds ? undefined : 50,
          cursor: specificAlbumIds ? undefined : cursorRef.current,
          folder: folderFilter || undefined,
          services: getServicesForSelection()
        };

        const res = await fetch('/api/enrich-sources/fetch-candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        if (result.nextCursor !== undefined && result.nextCursor !== null) {
          cursorRef.current = result.nextCursor;
        } else {
          if (!result.results || result.results.length === 0) {
             hasMoreRef.current = false;
          }
        }

        const candidates = result.results || [];

        if (result.processedCount > candidates.length) {
          collectedSummary.push({
            album: 'Batch Scan',
            field: 'Multiple Albums',
            action: 'No New Data Found for some items'
          });
        }

        if (candidates.length === 0 && hasMoreRef.current === false) {
          break; 
        }

        // UPDATED: Destructure summary from return logic
        const { conflicts: batchConflicts, summary: batchSummaryItems } = await processBatchAndSave(candidates);
        
        collectedConflicts = [...collectedConflicts, ...batchConflicts];
        // Safely add items only if they exist
        if (batchSummaryItems && batchSummaryItems.length > 0) {
            collectedSummary = [...collectedSummary, ...batchSummaryItems];
        }

        if (specificAlbumIds) break;

      } catch (error) {
        setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setEnriching(false);
        isLoopingRef.current = false;
        return;
      }
    }

    setEnriching(false);

    // UPDATED: Push the accumulated summary to the UI only at the end
    if (collectedSummary.length > 0) {
        setBatchSummary(prev => [...(prev || []), ...collectedSummary]);
    }

    if (collectedConflicts.length > 0) {
      setConflicts(collectedConflicts);
      setShowReview(true);
      setStatus(`Review required for ${collectedConflicts.length} items.`);
    } else {
      setStatus('✅ No conflicts found in this batch.');
      if (isLoopingRef.current && hasMoreRef.current) {
        setTimeout(() => runScanLoop(), 1000);
      } else {
        setStatus('Enrichment complete.');
        if (onImportComplete) onImportComplete();
        loadStats();
      }
    }
  }

  async function processBatchAndSave(results: CandidateResult[]) {
    const albumIds = results.map(r => r.album.id);
    const { data: resolutions, error: resError } = await supabase
      .from('import_conflict_resolutions')
      .select('album_id, field_name, source')
      .in('album_id', albumIds)
      .limit(10000);
      
    if (resError) console.error('Error fetching history:', resError);

    const autoUpdates: { id: number; fields: Record<string, unknown> }[] = [];
    const newConflicts: ExtendedFieldConflict[] = [];
    const processedIds: number[] = [];
    const historyUpdates: { album_id: number; field_name: string; source: string; resolution: string; kept_value: unknown; resolved_at: string }[] = [];
    const trackSavePromises: Promise<unknown>[] = [];
    
    // PRIORITY MATRICES
    const GLOBAL_PRIORITY = ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'lastfm', 'coverArt', 'wikipedia', 'genius', 'whosampled', 'secondhandsongs'];
    
    // "Discogs Supremacy" for physical/static metadata
    const STATIC_PRIORITY = ['discogs', 'musicbrainz', 'spotify', 'appleMusic'];
    
    // "Sonic" priority for audio features
    const SONIC_PRIORITY = ['spotify', 'acousticbrainz', 'musicbrainz'];

    // NEW: Local summary collector to avoid setting state in loop
    const localBatchSummary: {album: string, field: string, action: string}[] = [];

    results.forEach((item) => {
      processedIds.push(item.album.id);
      const { album, candidates } = item;
      
      // LOGGING: Explicitly report what was found before processing
      const foundKeys = new Set<string>();
      Object.values(candidates).forEach((c) => {
        if (c && typeof c === 'object') {
          Object.keys(c as Record<string, unknown>).forEach(k => foundKeys.add(k));
        }
      });
      
      if (foundKeys.size > 0) {
         // Create a readable summary of what was found
         const summary = Array.from(foundKeys)
            .filter(k => !['artist', 'title'].includes(k)) // Skip basics
            .map(k => k.replace(/_/g, ' '))
            .join(', ');
            
         if (summary) {
             addLog(`${album.artist} - ${album.title}`, 'info', `Found: ${summary}`);
         }
      }

      if (Object.keys(candidates).length === 0) return;

      const updatesForAlbum: Record<string, unknown> = {};
      const autoFilledFields: string[] = [];
      const fieldCandidates: Record<string, Record<string, unknown>> = {};

      for (const source of GLOBAL_PRIORITY) {
         const sourceData = (candidates as Record<string, Record<string, unknown>>)[source];
         if (!sourceData) continue;

         Object.entries(sourceData).forEach(([key, value]) => {
            if (!ALLOWED_COLUMNS.has(key)) return;
            
            // 1. Check Field Granularity: Is this field enabled?
            const allowedSources = fieldConfig[key];
            if (!allowedSources) return; // Field is disabled

            // 2. Check Source Granularity: Is this specific source allowed for this field?
            let normalizedSource = source;
            if (source === 'appleMusicEnhanced') normalizedSource = 'appleMusic';
            if (source === 'coverArt') normalizedSource = 'coverArtArchive';
            
            if (!allowedSources.has(normalizedSource)) return; // Source is disabled for this field
            // ------------------------------------------------------------------

            // Allow tracks and lyrics to pass through to fieldCandidates for review/save 
            if (['bpm', 'key', 'time_signature'].includes(key)) return;

            const finalized = (album as Record<string, unknown>).finalized_fields as string[] | undefined;
            if (Array.isArray(finalized) && finalized.includes(key)) return;

            const lastReviewed = (album as Record<string, unknown>).last_reviewed_at as string | undefined;
            if (lastReviewed) {
               const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
               if (new Date(lastReviewed).getTime() > thirtyDaysAgo) return; 
            }

            const alreadySeen = (resolutions as ResolutionHistory[] | null)?.some(r => 
               r.album_id === album.id && r.field_name === key && r.source === source
            );
            if (alreadySeen) return; 

            let newVal = value;
            if (key === 'original_release_date' && typeof newVal === 'string') {
                 if (/^\d{4}$/.test(newVal)) newVal = `${newVal}-12-25`;
                 if (!isValidDate(newVal)) return;
            }
            
            if (newVal !== null && newVal !== undefined && newVal !== '') {
               // Normalization: Ensure plural 'labels' column correctly receives data from 'label' key
               const targetKey = key === 'label' ? 'labels' : key;
               if (!fieldCandidates[targetKey]) fieldCandidates[targetKey] = {};
               fieldCandidates[targetKey][source] = newVal;
            }
         });

         const tracks = sourceData.tracks;
         if (Array.isArray(tracks) && tracks.length > 0) {
            const trackDot = (resolutions as ResolutionHistory[] | null)?.some(r => 
               r.album_id === album.id && r.field_name === 'track_data' && r.source === source
            );
            if (!trackDot) {
               trackSavePromises.push(saveTrackData(album.id, tracks as unknown[]));
               historyUpdates.push({
                 album_id: album.id, field_name: 'track_data', source, resolution: 'keep_current', kept_value: 'tracks_updated', resolved_at: new Date().toISOString()
               });
            }
         }
      }

      // SMART MERGE & CONFLICT DETECTION
      Object.entries(fieldCandidates).forEach(([key, sourceValues]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentVal = (album as any)[key];
          const isCurrentEmpty = !currentVal || (Array.isArray(currentVal) && currentVal.length === 0);
          const sources = Object.keys(sourceValues);
          if (sources.length === 0) return;

          const ARRAY_FIELDS = ['genres', 'styles', 'musicians', 'producers', 'engineers', 'songwriters'];
          const isArrayField = ARRAY_FIELDS.includes(key);

          let proposedValue: unknown;
          let isMerge = false;

          // Strategy 1: Arrays -> Smart Union
          if (isArrayField) {
             const mergedSet = new Set<string>();
             const lowerCaseMap = new Set<string>();
             
             Object.values(sourceValues).forEach(val => {
                if (Array.isArray(val)) {
                   val.forEach(item => {
                      const str = String(item).trim();
                      const lower = str.toLowerCase().replace(/[^a-z0-9]/g, ''); // Normalize
                      if (!lowerCaseMap.has(lower)) {
                         mergedSet.add(str);
                         lowerCaseMap.add(lower);
                      }
                   });
                }
             });
             proposedValue = Array.from(mergedSet);
             isMerge = true;
          } 
          // Strategy 2: Single Values -> Priority Winner
          else {
             // Determine appropriate priority list based on field type
             let priorityList = GLOBAL_PRIORITY;
             
             if (['original_release_date', 'year', 'tracklist', 'labels', 'cat_no', 'country', 'barcode'].includes(key)) {
                priorityList = STATIC_PRIORITY;
             } else if (['tempo_bpm', 'musical_key', 'energy', 'danceability'].includes(key)) {
                priorityList = SONIC_PRIORITY;
             }

             // Pick the value from the highest priority source available
             const winnerSrc = priorityList.find(s => sources.includes(s)) || sources[0];
             proposedValue = sourceValues[winnerSrc];
          }

          // DECISION: Auto-Fill vs Conflict
          
          // Case A: Auto-Fill (Database is empty AND we have a valid proposal)
          // For Single values, we also check if sources disagree. If they do, we might want to review even if DB is empty.
          // But for Arrays, we always trust the merge if DB is empty.
          const uniqueSingleValues = new Set(Object.values(sourceValues).map(v => normalizeValue(v)));
          const singleValuesAgree = !isArrayField && uniqueSingleValues.size === 1;

          if (isCurrentEmpty && (isMerge || singleValuesAgree)) {
              updatesForAlbum[key] = proposedValue;
              autoFilledFields.push(key);
              
              // Log history for all contributing sources
              sources.forEach(src => {
                 historyUpdates.push({
                    album_id: album.id, field_name: key, source: src, resolution: 'auto_fill', kept_value: proposedValue, resolved_at: new Date().toISOString()
                 });
              });
          } 
          // Case B: Conflict (Database has data OR Sources disagree on a single value)
          else {
              // Check if the proposed value is actually different from DB
              if (!areValuesEqual(currentVal, proposedValue)) {
                  // Re-calculate primary source for the conflict record using the same logic
                  let priorityList = GLOBAL_PRIORITY;
                  if (['original_release_date', 'year', 'tracklist', 'labels', 'cat_no', 'country', 'barcode'].includes(key)) {
                     priorityList = STATIC_PRIORITY;
                  }
                  
                  const primarySource = isMerge ? 'merge' : (priorityList.find(s => sources.includes(s)) || sources[0]);
                  
                  newConflicts.push({
                      album_id: album.id,
                      field_name: key,
                      current_value: currentVal,
                      new_value: proposedValue,
                      source: primarySource, 
                      candidates: sourceValues, // Keep raw candidates for the dropdown picker
                      existing_finalized: album.finalized_fields || [],
                      artist: album.artist,
                      title: album.title,
                      format: (album.format as string) || 'Unknown',
                      year: album.year as string,
                      country: album.country as string,
                      cat_no: (album.cat_no as string) || '', 
                      barcode: (album.barcode as string) || '',
                      labels: (album.labels as string[]) || []
                   });
              }
          }
      });

      if (Object.keys(updatesForAlbum).length > 0) {
        updatesForAlbum.last_enriched_at = new Date().toISOString();
        autoUpdates.push({ id: album.id, fields: updatesForAlbum });
        
        const logDetails: string[] = [];

        autoFilledFields.forEach(field => {
          const val = updatesForAlbum[field];
          
          // Fix: Proper string conversion for arrays (genres, credits) to avoid "Complex Data"
          let valStr = String(val);
          if (Array.isArray(val)) {
            valStr = val.join(', ');
          } else if (typeof val === 'object' && val !== null) {
            valStr = JSON.stringify(val);
          }
          
          localBatchSummary.push({
            album: `${album.artist} - ${album.title}`,
            field: field,
            action: `Auto-Filled: ${valStr.substring(0, 50)}${valStr.length > 50 ? '...' : ''}`
          });

          // Fix: Log actual values instead of just field names
          logDetails.push(`${field} (${valStr.substring(0, 20)}${valStr.length > 20 ? '...' : ''})`);
        });

        if (logDetails.length > 0) {
          addLog(`${album.artist} - ${album.title}`, 'auto-fill', `Added: ${logDetails.join(', ')}`);
        }
      }
    });

    if (historyUpdates.length > 0) {
       await supabase.from('import_conflict_resolutions').upsert(historyUpdates, { onConflict: 'album_id,field_name,source' });
    }

    if (autoUpdates.length > 0) {
      await Promise.all(autoUpdates.map(u => supabase.from('collection').update(u.fields).eq('id', u.id)));
    }
    
    if (trackSavePromises.length > 0) {
      await Promise.all(trackSavePromises);
    }

    const changedIds = new Set(autoUpdates.map(u => u.id));
    newConflicts.forEach(c => changedIds.add(c.album_id));
    const untouchedIds = processedIds.filter(id => !changedIds.has(id));
    
    if (untouchedIds.length > 0) {
      await supabase.from('collection').update({ last_enriched_at: new Date().toISOString() }).in('id', untouchedIds);
    }

    // UPDATED: Return summary instead of setting state directly
    return { conflicts: newConflicts, summary: localBatchSummary };
  }
  
  async function saveTrackData(albumId: number, enrichedTracks: unknown[]) {
    const { data: existingTracks } = await supabase
      .from('tracks')
      .select('id, title, position')
      .eq('album_id', albumId);

    if (!existingTracks || existingTracks.length === 0) return 0;

    const updates: Promise<unknown>[] = [];
    for (const t of existingTracks) {
       const match = (enrichedTracks as Record<string, unknown>[]).find(et => 
         String(et.title).toLowerCase() === t.title.toLowerCase() ||
         (et.position && et.position === t.position)
       );

       if (match) {
         const patch: Record<string, unknown> = {};
         // FIXED: Use correct property names from enrichment-utils
         if (match.tempo_bpm) patch.tempo_bpm = match.tempo_bpm;
         if (match.musical_key) patch.musical_key = match.musical_key;
         if (match.lyrics) patch.lyrics = match.lyrics;
         
         // NEW: Sonic Domain Fields
         if (match.is_cover !== undefined) patch.is_cover = match.is_cover;
         if (match.original_artist) patch.original_artist = match.original_artist;
         if (match.original_year) patch.original_year = match.original_year;
         if (match.mb_work_id) patch.mb_work_id = match.mb_work_id;

         if (Object.keys(patch).length > 0) {
            updates.push(Promise.resolve(supabase.from('tracks').update(patch).eq('id', t.id)));
         }
       }
    }
    
    if (updates.length > 0) {
       await Promise.all(updates);
       return updates.length;
    }
    return 0;
  }

  async function handleApplyChanges(
    resolutions: Record<string, { value: unknown; source: string }>,
    finalizedFields?: Record<string, boolean>
  ) {
    const updatesByAlbum: Record<number, Record<string, unknown>> = {};
    const resolutionRecords: Record<string, unknown>[] = [];
    const timestamp = new Date().toISOString();
    const involvedAlbumIds = new Set<number>();
    const localSummary: { field: string, album: string, action: string }[] = [];
    const trackSavePromises: Promise<number>[] = [];

    conflicts.forEach((c) => {
      involvedAlbumIds.add(c.album_id);
      const baseKey = `${c.album_id}-${c.field_name}`;
      const decision = resolutions[baseKey] as { value: unknown, source: string, selectedSources?: string[] };
      
      if (decision) {
        if (!updatesByAlbum[c.album_id]) updatesByAlbum[c.album_id] = {};
        updatesByAlbum[c.album_id][c.field_name] = decision.value;
        
        let actionText = 'Updated';
        if (decision.source === 'current') actionText = 'Kept Current';
        if (decision.source === 'merge') actionText = 'Merged';
        
        localSummary.push({ 
          field: c.field_name, 
          album: `${c.artist} - ${c.title}`, 
          action: actionText 
        });
        
        // ADDED: Logging for manual changes
        addLog(`${c.artist} - ${c.title}`, 'conflict-resolved', `${actionText} ${c.field_name}`);

        const trackSource = (decision.source === 'current' || decision.source === 'merge') ? null : decision.source;
        if (trackSource && c.candidates?.[trackSource]) {
          // Cast to specific type to avoid 'any' error
          const candidateData = c.candidates[trackSource] as { tracks?: unknown[] };
          if (candidateData.tracks) {
            trackSavePromises.push(saveTrackData(c.album_id, candidateData.tracks));
          }
        }
      }

      const isFinalized = finalizedFields?.[baseKey] || false;
      if (isFinalized) {
        if (!updatesByAlbum[c.album_id]) updatesByAlbum[c.album_id] = {};
        const finalizedList = c.existing_finalized || [];
        if (!finalizedList.includes(c.field_name)) {
          updatesByAlbum[c.album_id].finalized_fields = [...finalizedList, c.field_name];
        }
      }

      if (!updatesByAlbum[c.album_id]) updatesByAlbum[c.album_id] = {};
      updatesByAlbum[c.album_id].last_reviewed_at = timestamp;

      if (c.candidates) {
        Object.entries(c.candidates).forEach(([src]) => {
          const isChosenSource = decision?.source === src || decision?.selectedSources?.includes(src);
          resolutionRecords.push({
            album_id: c.album_id, 
            field_name: c.field_name,
            source: src, 
            resolution: isChosenSource ? 'use_new' : 'keep_current',
            kept_value: decision?.value ?? c.current_value,
            resolved_at: timestamp
          });
        });
      }
    });

    const updatePromises = Array.from(involvedAlbumIds).map(async (albumId) => {
      const rawUpdates = updatesByAlbum[albumId];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitizedUpdates: Record<string, any> = { ...rawUpdates, last_enriched_at: timestamp };

      // Ensure Array columns (text[]) match the database type to prevent 400 errors
      const arrayFields = ['labels', 'genres', 'styles', 'finalized_fields', 'enrichment_sources'];
      arrayFields.forEach(field => {
        if (sanitizedUpdates[field] !== undefined && sanitizedUpdates[field] !== null) {
           if (!Array.isArray(sanitizedUpdates[field])) {
              sanitizedUpdates[field] = [sanitizedUpdates[field]];
           }
        }
      });

      const { error } = await supabase
        .from('collection')
        .update(sanitizedUpdates)
        .eq('id', albumId);
        
      if (error) {
          console.error(`[DB ERROR] Album ${albumId}:`, error.message, error.details);
          // VISIBILITY: Log why the save failed
          addLog(`${albumId}`, 'skipped', `Save Failed: ${error.message}`);
      }
    });

    if (resolutionRecords.length > 0) {
      await supabase.from('import_conflict_resolutions').upsert(resolutionRecords, { 
        onConflict: 'album_id,field_name,source' 
      });
    }

    await Promise.all([...updatePromises, ...trackSavePromises]);
    setBatchSummary(prev => [...(prev || []), ...localSummary]);
    setShowReview(false);
  }

  async function showCategory(category: string, title: string) {
    setShowCategoryModal(true);
    setCategoryTitle(title);
    setCategoryAlbums([]);
    setLoadingCategory(true);
    try {
      const res = await fetch(`/api/enrich-sources/albums?category=${category}&limit=100`);
      const data = await res.json();
      if (data.success) setCategoryAlbums(data.albums || []);
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoadingCategory(false);
    }
  }

  if (!isOpen) return null;

  if (showReview) {
    return (
      <EnrichmentReviewModal 
        conflicts={conflicts} 
        onComplete={handleApplyChanges}
        onCancel={() => { 
          setShowReview(false); 
          isLoopingRef.current = false; 
          setStatus('Review cancelled. Scanning stopped.'); 
        }}
      />
    );
  }

  if (batchSummary) {
    return (
      <div className={styles.importModalContainer} style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
        <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '500px', color: '#111827' }}>
          <h3 style={{ marginBottom: '15px', fontWeight: '700' }}>Batch Review Summary</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', marginBottom: '20px', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Album / Field</th>
                  <th style={{ padding: '10px', borderBottom: '1px solid #eee' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batchSummary.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '600', color: '#111827' }}>{s.album}</div>
                      <div style={{ color: '#6b7280', fontSize: '11px' }}>{s.field.replace(/_/g, ' ').toUpperCase()}</div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        fontWeight: '700',
                        backgroundColor: s.action.includes('Auto') ? '#ecfdf5' : (s.action.includes('No') ? '#fef2f2' : '#eff6ff'),
                        color: s.action.includes('Auto') ? '#047857' : (s.action.includes('No') ? '#991b1b' : '#1d4ed8')
                      }}>
                        {s.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button 
            onClick={() => {
              setBatchSummary(null);
              if (isLoopingRef.current && hasMoreRef.current) {
                runScanLoop();
              } else {
                loadStats();
                if (onImportComplete) onImportComplete();
              }
            }} 
            className={styles.importConfirmButton}
            style={{ width: '100%', padding: '12px' }}
          >
            Continue to Next Batch
          </button>
        </div>
      </div>
    );
  }

  const dataCategoriesConfig: { category: DataCategory; count: number; subcounts?: { label: string; count: number }[] }[] = stats ? [
    { category: 'artwork', count: stats.missingArtwork, subcounts: [
        { label: 'Back covers', count: stats.missingBackCover },
        { label: 'Spine', count: stats.missingSpine || 0 },
    ]},
    { category: 'credits', count: stats.missingCredits, subcounts: [
        { label: 'Musicians', count: stats.missingMusicians },
        { label: 'Producers', count: stats.missingProducers },
    ]},
    { category: 'tracklists', count: stats.missingTracklists, subcounts: [
        { label: 'Missing Durations', count: stats.missingDurations || 0 }
    ]},
    { category: 'sonic_domain', count: stats.missingAudioAnalysis, subcounts: [
        { label: 'Tempo', count: stats.missingTempo },
        { label: 'Key', count: stats.missingMusicalKey || 0 },
    ]},
    { category: 'genres', count: stats.missingGenres, subcounts: [
        { label: 'Styles', count: stats.missingStyles || 0 }
    ]},
    { category: 'streaming_links', count: stats.missingStreamingLinks, subcounts: [
        { label: 'Spotify', count: stats.missingSpotify },
    ]},
    { category: 'release_metadata', count: stats.missingReleaseMetadata, subcounts: [
        { label: 'Barcodes', count: stats.missingBarcode || 0 },
        { label: 'Labels', count: stats.missingLabels || 0 },
    ]},
    { category: 'cultural_context', count: 0, subcounts: [] }, // New category
  ] : [];

  return (
    <div className={styles.importModalContainer}>
      <div className={styles.importModalContent}>
        <div className={styles.importModalInner} style={{ width: '1200px', maxWidth: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* HEADER */}
        <div className={styles.importModalHeader}>
          <h2 className={styles.importModalTitle}>⚡ Collection Data Enrichment</h2>
          <button onClick={onClose} disabled={enriching} className={styles.importModalCloseButton}>×</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading statistics...</div>
          ) : stats ? (
            <>
              {/* 1. OVERVIEW STATS */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>Collection Overview</h3>
                <div className={styles.importPreviewStats} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <StatBox label="Total Albums" value={stats.total} color="#3b82f6" onClick={() => {}} disabled />
                  <StatBox label="Fully Enriched" value={stats.fullyEnriched} color="#10b981" onClick={() => showCategory('fully-enriched', 'Fully Enriched')} />
                  <div style={{ position: 'relative' }}>
                    <StatBox label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" onClick={() => showCategory('needs-enrichment', 'Needs Enrichment')} />
                    {/* RESTORED: Snooze Badge */}
                    <div style={{ position: 'absolute', top: '-10px', right: '10px', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', color: '#6b7280', border: '1px solid #e5e7eb', fontWeight: '600' }}>
                      Auto-Snooze Active
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. DATA CATEGORY SELECTION */}
              <div className={styles.importEnrichCard}>
                <h3 className={styles.importEnrichHeader}>Select Data to Enrich</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                  {/* Note: dataCategoriesConfig is used for sorting/structure, but props are new */}
                  {dataCategoriesConfig.map(({ category }) => (
                    <DataCategoryCard
                      key={category} 
                      category={category} 
                      stats={stats}
                      fieldConfig={fieldConfig}
                      onToggleCategory={() => toggleCategory(category)}
                      onToggleField={toggleField}
                      onToggleFieldSource={toggleFieldSource}
                      disabled={enriching}
                    />
                  ))}
                </div>
              </div>

              {/* 3. FILTERS */}
              <div className={styles.importEnrichCard} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>Folder:</label>
                  <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} disabled={enriching} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', color: '#111827' }}>
                    <option value="">All Folders</option>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>Batch Size:</label>
                  <select value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={enriching} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #d1d5db', color: '#111827' }}>
                    <option value="25">25 (Recommended)</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>

              {/* 4. SESSION LOG */}
              {sessionLog.length > 0 && (
                <div style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                    Session Activity ({sessionLog.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '8px', backgroundColor: 'white' }}>
                    {sessionLog.map(log => (
                      <div key={log.id} style={{ fontSize: '12px', marginBottom: '4px', display: 'flex', gap: '8px' }}>
                        <span style={{ color: '#9ca3af' }}>{log.timestamp.toLocaleTimeString()}</span>
                        <span style={{ fontWeight: '600', color: log.action === 'auto-fill' ? '#10b981' : '#f59e0b' }}>
                          {log.action === 'auto-fill' ? '✅' : '✏️'}
                        </span>
                        <span style={{ flex: 1, color: '#111827' }}>
                          <b>{log.album}:</b> {log.details}
                        </span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}

              {/* STATUS */}
              {status && (
                <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '500' }}>
                  {status}
                </div>
              )}
            </>
          ) : (
            <div className={styles.importError}>Failed to load statistics.</div>
          )}
        </div>

        {/* FOOTER */}
        <div className={styles.importButtonContainer} style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} disabled={enriching} className={styles.importCancelButton}>Close</button>
          <button 
            onClick={() => startEnrichment()} 
            disabled={enriching || !stats || Object.keys(fieldConfig).length === 0} 
            className={styles.importConfirmButton}
            style={{ backgroundColor: enriching ? '#d1d5db' : undefined, cursor: enriching ? 'not-allowed' : undefined }}
          >
            {enriching ? 'Scanning...' : '⚡ Start Scan & Review'}
          </button>
        </div>
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {showCategoryModal && (
        <div className={styles.importModalContainer} style={{ background: 'rgba(0,0,0,0.7)' }}>
           <div className={styles.importModalContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '1000px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#111827' }}>
            <div className={styles.importModalHeader}>
              <h3 className={styles.importModalTitle}>{categoryTitle}</h3>
              <button onClick={() => setShowCategoryModal(false)} className={styles.importModalCloseButton}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {loadingCategory ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
              ) : (
                <>
                  <button 
                     onClick={() => startEnrichment(categoryAlbums.map(a => a.id))}
                     disabled={enriching || categoryAlbums.length === 0}
                     className={styles.importConfirmButton}
                     style={{ width: '100%', marginBottom: '16px' }}
                  >
                    Scan These {categoryAlbums.length} Albums
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                    {categoryAlbums.map(album => (
                      <div key={album.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', marginBottom: '6px', backgroundColor: '#eee' }}>
                           {album.image_url && <Image src={album.image_url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />}
                        </div>
                        <div style={{ fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', color: '#111827' }}>{album.title}</div>
                        <div style={{ color: '#6b7280', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{album.artist}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StatBox({ label, value, color, onClick, disabled }: { label: string; value: number; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} className={styles.importPreviewStat} style={{ border: `2px solid ${color}`, cursor: disabled ? 'default' : 'pointer' }}>
      <div className={styles.importPreviewStatValue} style={{ color }}>{value.toLocaleString()}</div>
      <div className={styles.importPreviewStatLabel}>{label}</div>
    </div>
  );
}

function DataCategoryCard({ 
  category, 
  stats,
  fieldConfig,
  onToggleCategory,
  onToggleField,
  onToggleFieldSource,
  disabled 
}: { 
  category: DataCategory; 
  stats: EnrichmentStats | null;
  fieldConfig: FieldConfigMap;
  onToggleCategory: () => void;
  onToggleField: (f: string) => void;
  onToggleFieldSource: (f: string, s: string) => void;
  disabled: boolean; 
}) {
  const fields = DATA_CATEGORY_CHECK_FIELDS[category] || [];
  const validFields = fields.filter(f => ALLOWED_COLUMNS.has(f));
  
  if (validFields.length === 0) return null;

  const activeCount = validFields.filter(f => !!fieldConfig[f]).length;
  const isAllSelected = activeCount === validFields.length;
  const isIndeterminate = activeCount > 0 && !isAllSelected;

  const formatLabel = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const getMissing = (field: string) => {
    if (!stats) return 0;
    if (field === 'image_url') return stats.missingArtwork;
    if (field === 'back_image_url') return stats.missingBackCover;
    if (field.includes('musicians')) return stats.missingMusicians;
    if (field.includes('bpm')) return stats.missingTempo;
    return 0;
  };

  return (
    // Removed hardcoded background/opacity styles to let CSS Modules handle theme
    <div className={styles.importSelectionCard} data-disabled={disabled}>
      {/* HEADER */}
      <div 
        className={styles.cardHeader}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}
      >
         <input 
            type="checkbox" 
            checked={isAllSelected}
            ref={el => { if(el) el.indeterminate = isIndeterminate; }}
            onChange={onToggleCategory}
            disabled={disabled}
            style={{ cursor: 'pointer' }}
         />
         <span style={{ fontSize: '16px' }}>{DATA_CATEGORY_ICONS[category]}</span>
         <span style={{ fontWeight: '700', fontSize: '13px' }}>{DATA_CATEGORY_LABELS[category]}</span>
      </div>

      {/* FIELD ROWS (Dashboard Style) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
         {validFields.map(field => {
            const isEnabled = !!fieldConfig[field];
            const activeSources = fieldConfig[field] || new Set();
            const services = FIELD_TO_SERVICES[field] || [];
            const missing = getMissing(field);

            return (
               <div key={field} className={isEnabled ? styles.fieldRowActive : styles.fieldRow}>
                  {/* Row Top: Checkbox + Name + Stats */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                        <input 
                           type="checkbox" 
                           checked={isEnabled} 
                           onChange={() => onToggleField(field)}
                           disabled={disabled}
                        />
                        {formatLabel(field)}
                     </label>
                     {missing > 0 && <span className={styles.missingBadge}>{missing}</span>}
                  </div>

                  {/* Row Bottom: Source Toggles (Only if enabled) */}
                  {isEnabled && services.length > 0 && (
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: '20px', marginTop: '4px' }}>
                        {services.map(srv => {
                           const isActive = activeSources.has(srv);
                           return (
                              <label 
                                key={srv} 
                                title={srv}
                                className={isActive ? styles.sourceTagActive : styles.sourceTag}
                              >
                                 <input 
                                    type="checkbox" 
                                    checked={isActive} 
                                    onChange={() => onToggleFieldSource(field, srv)}
                                    disabled={disabled}
                                    style={{ display: 'none' }}
                                 />
                                 {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                 <span>{(SERVICE_ICONS as any)[srv]}</span>
                                 <span>{srv}</span>
                              </label>
                           );
                        })}
                     </div>
                  )}
               </div>
            );
         })}
      </div>
    </div>
  );
}