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
import styles from '../EditCollection.module.css';

// --- 1. DATA CATEGORY DEFINITIONS ---
export type DataCategory = 
  | 'artwork' | 'credits' | 'tracklists' | 'audio_analysis' 
  | 'genres' | 'streaming_links' | 'release_metadata';

// MODEL INSTRUCTION: DO NOT COLLAPSE THIS OBJECT. KEEP EXPANDED.
const DATA_CATEGORY_CONFIG: Record<DataCategory, { label: string; desc: string; icon: string; services: string[] }> = {
  artwork: {
    label: 'Artwork & Images',
    desc: 'Front covers, back covers, spine images, and inner sleeves.',
    icon: '🖼️',
    services: ['coverArt', 'spotify', 'appleMusic']
  },
  credits: {
    label: 'Credits & Personnel',
    desc: 'Musicians, producers, engineers, and songwriters.',
    icon: '👥',
    services: ['musicbrainz', 'wikipedia']
  },
  tracklists: {
    label: 'Tracklists & Durations',
    desc: 'Complete track listings, disk sides, and track durations.',
    icon: '📝',
    services: ['spotify', 'appleMusic']
  },
  audio_analysis: {
    label: 'Audio Analysis',
    desc: 'Tempo (BPM), musical key, danceability, and energy metrics.',
    icon: '📊',
    services: ['spotify']
  },
  genres: {
    label: 'Genres & Styles',
    desc: 'Primary genres, sub-styles, and mood tags.',
    icon: '🏷️',
    services: ['lastfm', 'spotify']
  },
  streaming_links: {
    label: 'Streaming IDs & URLs',
    desc: 'Links to Spotify, Apple Music, and Last.fm.',
    icon: '🔗',
    services: ['spotify', 'appleMusic', 'lastfm']
  },
  release_metadata: {
    label: 'Release Metadata',
    desc: 'Barcodes, record labels, and original release dates.',
    icon: '💿',
    services: ['musicbrainz']
  }
};

// --- 2. TYPES ---
interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type EnrichmentStats = {
  total: number;
  needsEnrichment: number;
  fullyEnriched: number;
  missingArtwork: number;
  missingBackCover: number;
  missingCredits: number;
  missingMusicians: number;
  missingProducers: number;
  missingTracklists: number;
  missingAudioAnalysis: number;
  missingTempo: number;
  missingGenres: number;
  missingStreamingLinks: number;
  missingSpotify: number;
  missingReleaseMetadata: number;
  missingCatalogNumber: number;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
};

interface CandidateResult {
  album: Record<string, unknown> & { id: number; artist: string; title: string };
  candidates: Record<string, unknown>;
}

type LogEntry = {
  id: string;
  album: string;
  action: 'auto-fill' | 'conflict-resolved' | 'skipped';
  details: string;
  timestamp: Date;
};

// Extended type for Multi-Source Conflicts
export type ExtendedFieldConflict = FieldConflict & {
  source: string;
  candidates?: Record<string, unknown>; // map of source -> value
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
  
  const [selectedCategories, setSelectedCategories] = useState<Set<DataCategory>>(new Set([
    'artwork', 'credits', 'tracklists', 'genres'
  ]));
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  const [showReview, setShowReview] = useState(false);
  const [conflicts, setConflicts] = useState<ExtendedFieldConflict[]>([]);
  const [sessionLog, setSessionLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

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
    const serviceMap: Record<string, boolean> = {
      musicbrainz: false, spotify: false, discogs: false, lastfm: false,
      appleMusicEnhanced: false, wikipedia: false, genius: false, coverArt: false,
    };

    selectedCategories.forEach(cat => {
      const config = DATA_CATEGORY_CONFIG[cat];
      if (config) {
        config.services.forEach(service => {
          if (service === 'appleMusic') serviceMap.appleMusicEnhanced = true;
          else serviceMap[service] = true;
        });
      }
    });
    
    return serviceMap;
  }

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
    if (selectedCategories.size === 0) {
      alert('Please select at least one data category');
      return;
    }

    // Reset loop state
    hasMoreRef.current = true;
    isLoopingRef.current = true;
    cursorRef.current = 0; // Start from beginning
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

    // Fetch batches until we have enough conflicts OR run out of items
    while ((collectedConflicts.length < targetConflicts || specificAlbumIds) && hasMoreRef.current) {
      setStatus(`Scanning (Cursor: ${cursorRef.current})... Found ${collectedConflicts.length}/${targetConflicts} conflicts.`);

      try {
        const payload = {
          albumIds: specificAlbumIds,
          limit: specificAlbumIds ? undefined : 50,
          cursor: specificAlbumIds ? undefined : cursorRef.current, // Pass current position
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

        // Update Cursor for next iteration
        if (result.nextCursor !== undefined && result.nextCursor !== null) {
          cursorRef.current = result.nextCursor;
        } else {
          // If api returned no cursor, we might be done
          if (!result.results || result.results.length === 0) {
             hasMoreRef.current = false;
          }
        }

        const candidates = result.results || [];

        if (candidates.length === 0 && hasMoreRef.current === false) {
          break; // Done
        }

        // Process this batch
        const { conflicts: batchConflicts } = await processBatchAndSave(candidates);
        
        collectedConflicts = [...collectedConflicts, ...batchConflicts];

        if (specificAlbumIds) break;

      } catch (error) {
        setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setEnriching(false);
        isLoopingRef.current = false;
        return;
      }
    }

    setEnriching(false);

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
        loadStats();
      }
    }
  }

  async function processBatchAndSave(results: CandidateResult[]) {
    // 1. FETCH PREVIOUS RESOLUTIONS
    const albumIds = results.map(r => r.album.id);
    const { data: resolutions, error: resError } = await supabase
      .from('import_conflict_resolutions')
      .select('album_id, field_name, source')
      .in('album_id', albumIds);
      
    if (resError) console.error('Error fetching history:', resError);

    // 2. DEFINE ALLOWLIST
    // CRITICAL UPDATE: Added 'spine_image_url', 'inner_sleeve_images', 'vinyl_label_images'
    // PLUS: Musicians, Credits, BPM, Lyrics, Classical info
    const ALLOWED_COLUMNS = new Set([
      'artist', 'title', 'year', 'format', 'country', 'barcode', 'labels',
      'tracklists', 'image_url', 'back_image_url', 'sell_price', 'media_condition', 'folder',
      'discogs_master_id', 'discogs_release_id', 'spotify_id', 'spotify_url',
      'apple_music_id', 'apple_music_url', 
      'genres', 'styles',
      'original_release_date',
      'spine_image_url', 'inner_sleeve_images', 'vinyl_label_images',
      // NEW ADDITIONS:
      'musicians', 'credits', 'producers', 'composer', 'conductor', 'orchestra',
      'bpm', 'key', 'lyrics', 'time_signature'
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoUpdates: { id: number; fields: Record<string, any> }[] = [];
    const newConflicts: ExtendedFieldConflict[] = [];
    const processedIds: number[] = [];

    // NEW: History updates for Auto-Fills (The "Red Dot" application)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyUpdates: { album_id: number; field_name: string; source: string; resolution: string; kept_value: any; resolved_at: string }[] = [];

    // Helper for async track saving
    const trackSavePromises: Promise<void>[] = [];

    // Source Priority Order
    const SOURCE_PRIORITY = ['musicbrainz', 'spotify', 'appleMusic', 'discogs', 'lastfm', 'coverArt', 'wikipedia', 'genius'];

    results.forEach((item) => {
      processedIds.push(item.album.id);
      const { album, candidates } = item;
      if (Object.keys(candidates).length === 0) return;

      // DEBUG: Verify new fields are present in the payload (Restored from legacy)
      const allCandidateKeys = Object.values(candidates).flatMap(c => Object.keys(c as object));
      if (allCandidateKeys.some(k => ['spine_image_url', 'inner_sleeve_images', 'vinyl_label_images'].includes(k))) {
         console.log('[Enrich Debug] Found extended image fields for:', album.title, candidates);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatesForAlbum: Record<string, any> = {};
      const autoFilledFields: string[] = [];

      // --- LOGIC UPDATE: Collect Candidates First ---
      // We gather all potential values for each field from all sources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldCandidates: Record<string, Record<string, any>> = {};

      for (const source of SOURCE_PRIORITY) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const sourceData = (candidates as any)[source];
         if (!sourceData) continue;

         // A. Gather Album Fields
         Object.entries(sourceData).forEach(([key, value]) => {
            if (!ALLOWED_COLUMNS.has(key)) return;
            // Skip track fields here (handled differently)
            if (['lyrics', 'bpm', 'key', 'time_signature', 'tracks'].includes(key)) return;

            // CHECK RED DOT: Has this specific source value been handled?
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const alreadySeen = resolutions?.some(r => r.album_id === album.id && r.field_name === key && (r as any).source === source);
            if (alreadySeen) return; 

            // Transform value (Date Fix)
            let newVal = value;
            if (key === 'original_release_date' && typeof newVal === 'string') {
                 if (/^\d{4}$/.test(newVal)) newVal = `${newVal}-12-25`;
                 if (!isValidDate(newVal)) return;
            }
            
            // Only add if defined
            if (newVal !== null && newVal !== undefined && newVal !== '') {
               if (!fieldCandidates[key]) fieldCandidates[key] = {};
               fieldCandidates[key][source] = newVal;
            }
         });

         // B. Handle Track Data immediately (Simplified for tracks as per original logic structure)
         // Note: Logic kept separate as tracks aren't in standard field flow
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const tracks = (sourceData as any).tracks;
         if (Array.isArray(tracks) && tracks.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const trackDot = resolutions?.some(r => r.album_id === album.id && r.field_name === 'track_data' && (r as any).source === source);
            if (!trackDot) {
               // We only process tracks if we haven't seen them.
               trackSavePromises.push(saveTrackData(album.id, tracks).then(count => {
                  if (count > 0) { /* logged internally */ }
               }));
               historyUpdates.push({
                 album_id: album.id, field_name: 'track_data', source, resolution: 'use_new', kept_value: 'tracks_updated', resolved_at: new Date().toISOString()
               });
            }
         }
      }

      // --- PROCESS GROUPED CANDIDATES ---
      Object.entries(fieldCandidates).forEach(([key, sourceValues]) => {
          const currentVal = album[key];
          const isCurrentEmpty = !currentVal || (Array.isArray(currentVal) && currentVal.length === 0);
          
          // Get unique values to check for agreement
          const uniqueValues = new Set(Object.values(sourceValues).map(v => normalizeValue(v)));
          const sources = Object.keys(sourceValues);
          
          if (sources.length === 0) return;

          // TEST OVERRIDE: Prevent auto-fill for new fields
          const isTestField = ['spine_image_url', 'inner_sleeve_images', 'vinyl_label_images'].includes(key);

          // 1. AUTO-FILL: If DB is empty and all sources agree (or only one source)
          if (isCurrentEmpty && uniqueValues.size === 1 && !isTestField) {
              const winningVal = Object.values(sourceValues)[0];
              updatesForAlbum[key] = winningVal;
              autoFilledFields.push(key);
              
              // Mark all agreeing sources as resolved
              sources.forEach(src => {
                 historyUpdates.push({
                    album_id: album.id, field_name: key, source: src, resolution: 'use_new', kept_value: winningVal, resolved_at: new Date().toISOString()
                 });
              });
          } 
          // 2. CONFLICT: Values differ from DB, or multiple sources disagree
          else {
              // If DB has value, check if candidates are actually different
              const candidatesDifferFromDB = sources.some(src => !areValuesEqual(currentVal, sourceValues[src]));
              
              if (candidatesDifferFromDB || (isCurrentEmpty && uniqueValues.size > 1)) {
                  // We pick the "new_value" as the highest priority one for the simplified view,
                  // but we pass ALL candidates to the UI.
                  const primarySource = SOURCE_PRIORITY.find(s => sources.includes(s)) || sources[0];
                  
                  newConflicts.push({
                      album_id: album.id,
                      field_name: key,
                      current_value: currentVal,
                      new_value: sourceValues[primarySource], // Default "primary" proposal
                      source: primarySource, // Explicitly set source
                      candidates: sourceValues, // PASS ALL CANDIDATES
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
        if (autoFilledFields.length > 0) {
          addLog(`${album.artist} - ${album.title}`, 'auto-fill', `Added: ${autoFilledFields.join(', ')}`);
        }
      }
    });

    // 1. SAVE HISTORY (RED DOTS)
    if (historyUpdates.length > 0) {
       await supabase.from('import_conflict_resolutions').upsert(historyUpdates, { onConflict: 'album_id,field_name,source' });
    }

    // 2. PERFORM AUTO UPDATES (ALBUMS)
    if (autoUpdates.length > 0) {
      await Promise.all(autoUpdates.map(u => 
        supabase.from('collection').update(u.fields).eq('id', u.id)
      ));
    }
    
    // 3. WAIT FOR TRACK UPDATES
    if (trackSavePromises.length > 0) {
      await Promise.all(trackSavePromises);
    }

    // 4. "TOUCH" UNCHANGED ALBUMS
    const changedIds = new Set(autoUpdates.map(u => u.id));
    newConflicts.forEach(c => changedIds.add(c.album_id));
    
    const untouchedIds = processedIds.filter(id => !changedIds.has(id));
    
    if (untouchedIds.length > 0) {
      await supabase
        .from('collection')
        .update({ last_enriched_at: new Date().toISOString() })
        .in('id', untouchedIds);
    }

    return { conflicts: newConflicts };
  }
  
  // NEW HELPER: Save enriched track data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function saveTrackData(albumId: number, enrichedTracks: any[]) {
    // 1. Get existing tracks for this album
    const { data: existingTracks } = await supabase
      .from('dj_tracks')
      .select('id, track_name, track_number')
      .eq('collection_id', albumId);

    if (!existingTracks || existingTracks.length === 0) return 0;

    // 2. Map and Update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any[] = [];
    
    for (const t of existingTracks) {
       // Fuzzy match the enriched track to our DB track
       const match = enrichedTracks.find(et => 
         et.title.toLowerCase() === t.track_name.toLowerCase() ||
         (et.position && et.position === t.track_number)
       );

       if (match) {
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const patch: Record<string, any> = {};
         if (match.bpm) patch.bpm = match.bpm;
         if (match.key) patch.musical_key = match.key;
         if (match.lyrics) patch.lyrics = match.lyrics;

         if (Object.keys(patch).length > 0) {
            updates.push(supabase.from('dj_tracks').update(patch).eq('id', t.id));
         }
       }
    }
    
    if (updates.length > 0) {
       await Promise.all(updates);
       console.log(`[Track Sync] Updated ${updates.length} tracks for album ${albumId}`);
       return updates.length; // RETURN COUNT
    }
    return 0;
  }

  // UPDATED: Now accepts resolutions map with extended source info
  async function handleApplyChanges(resolutions: Record<string, { value: unknown, source: string }>) {
    const updatesByAlbum: Record<number, Record<string, unknown>> = {};
    const resolutionRecords: Record<string, unknown>[] = [];
    const timestamp = new Date().toISOString();
    
    const involvedAlbumIds = new Set<number>();

    conflicts.forEach(c => {
      involvedAlbumIds.add(c.album_id);
      
      const baseKey = `${c.album_id}-${c.field_name}`;
      const decision = resolutions[baseKey]; // { value, source }
      
      if (!decision) {
          // Default: Keep Current. Log rejection for all candidates.
          if (c.candidates) {
            Object.keys(c.candidates).forEach(src => {
                resolutionRecords.push({
                    album_id: c.album_id,
                    field_name: c.field_name,
                    kept_value: c.current_value,
                    rejected_value: c.candidates![src],
                    resolution: 'keep_current',
                    source: src,
                    resolved_at: timestamp
                });
            });
          }
          return;
      }

      const { value: chosenValue, source: chosenSource } = decision;
      const userChoseNew = !areValuesEqual(chosenValue, c.current_value);

      if (userChoseNew) {
        if (!updatesByAlbum[c.album_id]) updatesByAlbum[c.album_id] = {};
        updatesByAlbum[c.album_id][c.field_name] = chosenValue;
      }

      // HISTORY LOGIC:
      // 1. Mark the winner as 'use_new'
      // 2. Mark all other candidates as 'rejected'
      
      if (c.candidates) {
          Object.entries(c.candidates).forEach(([src, val]) => {
              const isWinner = src === chosenSource;
              
              if (userChoseNew && isWinner) {
                  resolutionRecords.push({
                      album_id: c.album_id,
                      field_name: c.field_name,
                      kept_value: chosenValue,
                      rejected_value: c.current_value,
                      resolution: 'use_new',
                      source: src,
                      resolved_at: timestamp
                  });
              } else {
                  if (!userChoseNew) {
                      // Kept Current
                      resolutionRecords.push({
                        album_id: c.album_id,
                        field_name: c.field_name,
                        kept_value: c.current_value,
                        rejected_value: val,
                        resolution: 'keep_current',
                        source: src,
                        resolved_at: timestamp
                    });
                  } else {
                      // We picked a new value, but this source wasn't it
                      resolutionRecords.push({
                          album_id: c.album_id,
                          field_name: c.field_name,
                          kept_value: chosenValue,
                          rejected_value: val,
                          resolution: 'rejected', // Explicit rejection
                          source: src,
                          resolved_at: timestamp
                      });
                  }
              }
          });
      }
    });

    // MODEL: DO NOT REMOVE DEBUG LOGGING
    console.log('[DB SAVE] Starting Batch Save...');
    console.log(`[DB SAVE] Updates Pending: ${Object.keys(updatesByAlbum).length} albums`);
    console.log(`[DB SAVE] History Records: ${resolutionRecords.length}`);
    
    // RESTORED: Console table for history records to see exactly WHAT is updated
    if (resolutionRecords.length > 0) {
       console.table(resolutionRecords.map(r => ({ 
         id: r.album_id, 
         field: r.field_name, 
         result: r.resolution,
         rejected: r.rejected_value
       })));
    }

    // A. Update Albums
    const updatePromises = Array.from(involvedAlbumIds).map(async (albumId) => {
      const fields = updatesByAlbum[albumId] || {};
      
      const { error } = await supabase
        .from('collection')
        .update({
          ...fields,
          last_enriched_at: timestamp
        })
        .eq('id', albumId);
        
      if (error) console.error(`[DB ERROR] Failed to update album ${albumId}:`, error);
      // ENHANCED: Log the fields being updated
      else console.log(`[DB SUCCESS] Updated album ${albumId}`, fields);
    });

    // B. Save History
    if (resolutionRecords.length > 0) {
      const { error: histError } = await supabase
        .from('import_conflict_resolutions')
        .upsert(resolutionRecords, { onConflict: 'album_id,field_name,source' });
        
      if (histError) console.error('[DB ERROR] Failed to save history:', histError);
      else console.log('[DB SUCCESS] Resolution history saved.');
    }

    await Promise.all(updatePromises);

    // 3. CONTINUE LOOP
    setShowReview(false);
    
    if (isLoopingRef.current && hasMoreRef.current) {
      addLog('System', 'auto-fill', 'Batch saved. Continuing scan...');
      setTimeout(() => runScanLoop(), 500);
    } else {
      await loadStats(); 
      setStatus('✅ Enrichment session complete.');
      if (onImportComplete) onImportComplete();
    }
  }

  function toggleCategory(category: DataCategory) {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) newSet.delete(category);
    else newSet.add(category);
    setSelectedCategories(newSet);
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
          isLoopingRef.current = false; // Stop the loop
          setStatus('Review cancelled. Scanning stopped.'); 
        }}
      />
    );
  }

  const dataCategoriesConfig: { category: DataCategory; count: number; subcounts?: { label: string; count: number }[] }[] = stats ? [
    { category: 'artwork', count: stats.missingArtwork, subcounts: [
        { label: 'Back covers', count: stats.missingBackCover },
    ]},
    { category: 'credits', count: stats.missingCredits, subcounts: [
        { label: 'Musicians', count: stats.missingMusicians },
        { label: 'Producers', count: stats.missingProducers },
    ]},
    { category: 'tracklists', count: stats.missingTracklists },
    { category: 'audio_analysis', count: stats.missingAudioAnalysis, subcounts: [
        { label: 'Tempo', count: stats.missingTempo },
    ]},
    { category: 'genres', count: stats.missingGenres },
    { category: 'streaming_links', count: stats.missingStreamingLinks },
    { category: 'release_metadata', count: stats.missingReleaseMetadata },
  ] : [];

  return (
    <div className={styles.importModalContainer}>
      <div className={styles.importModalContent} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '1200px', maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
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
                  <StatBox label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" onClick={() => showCategory('needs-enrichment', 'Needs Enrichment')} />
                </div>
              </div>

              {/* 2. DATA CATEGORY SELECTION */}
              <div className={styles.importEnrichCard}>
                <h3 className={styles.importEnrichHeader}>Select Data to Enrich</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                  {dataCategoriesConfig.map(({ category, count, subcounts }) => (
                    <DataCategoryCard
                      key={category}
                      category={category}
                      count={count}
                      subcounts={subcounts}
                      selected={selectedCategories.has(category)}
                      onToggle={() => toggleCategory(category)}
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
                <div style={{ padding: '12px', borderRadius: '6px', marginBottom: '16px', backgroundColor: status.includes('Error') ? '#fee2e2' : '#dcfce7', color: status.includes('Error') ? '#991b1b' : '#166534', fontWeight: '500' }}>
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
            disabled={enriching || !stats || selectedCategories.size === 0} 
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

function DataCategoryCard({ category, count, subcounts, selected, onToggle, disabled }: { category: DataCategory; count: number; subcounts?: { label: string; count: number }[]; selected: boolean; onToggle: () => void; disabled: boolean; }) {
  const config = DATA_CATEGORY_CONFIG[category];
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      onClick={disabled ? undefined : onToggle}
      className={styles.importSelectionCard}
      style={{ 
        borderColor: selected ? '#f59e0b' : '#e5e7eb', 
        backgroundColor: selected ? '#fff7ed' : 'white', 
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        gap: '10px'
      }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} disabled={disabled} style={{ marginTop: '2px', cursor: 'pointer' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px' }}>{config.icon}</span>
          <span className={styles.importSelectionCardTitle} style={{ fontSize: '14px', marginBottom: 0 }}>{config.label}</span>
          <span style={{ marginLeft: 'auto', fontWeight: '700', color: count > 0 ? '#ef4444' : '#10b981' }}>{count.toLocaleString()}</span>
        </div>
        <div className={styles.importSelectionCardDescription}>{config.desc}</div>
        
        {subcounts && subcounts.length > 0 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: '11px', color: '#3b82f6', cursor: 'pointer', fontWeight: '500' }}
            >
              {expanded ? '▼ Hide details' : '▶ Show details'}
            </button>
            {expanded && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280' }}>
                {subcounts.map((sub, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{sub.label}:</span>
                    <span style={{ fontWeight: '600', color: '#111827' }}>{sub.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}