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
  type EnrichmentService,
  DATA_CATEGORY_CHECK_FIELDS, 
  FIELD_TO_SERVICES,
  SERVICE_ICONS,
  DATA_CATEGORY_LABELS,
  DATA_CATEGORY_ICONS
} from 'lib/enrichment-data-mapping';

const ALLOWED_COLUMNS = new Set([
  'artist', 'title', 'year', 'format', 'country', 'barcode', 'labels', 'cat_no',
  'tracklists', 'tracklist', 'tracks', 'disc_metadata', 
  'image_url', 'back_image_url', 'sell_price', 'media_condition', 'location', // FIXED: Was 'folder'
  'discogs_master_id', 'discogs_release_id', 'spotify_id', 'spotify_url',
  'apple_music_id', 'apple_music_url', 'lastfm_id', 'lastfm_url', 
  'musicbrainz_id', 'musicbrainz_url', 'wikipedia_url', 'genius_url', 
  'lastfm_tags', 'notes', 'enriched_metadata', 'enrichment_summary', 'genres', 'styles', 'original_release_date',
  'inner_sleeve_images', 'musicians', 'credits', 'producers', 'engineers', 
  'songwriters', 'composer', 'conductor', 'orchestra',
  'tempo_bpm', 'musical_key', 'lyrics', 'time_signature', 
  'danceability', 'energy', 'mood_acoustic', 'mood_happy', 'mood_sad',
  'mood_aggressive', 'mood_electronic', 'mood_party', 'mood_relaxed',
  // --- UNBLOCKED FIELDS ---
  'samples', 'sampled_by',
  'is_cover', 'original_artist', 'original_year',
  'tracks.lyrics', 'tracks.lyrics_url',
  'cultural_significance', 'recording_location', 'critical_reception', 'awards', 'certifications',
  'allmusic_rating', 'pitchfork_score'
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
  // --- OPTIONAL STATS FOR NEW CATEGORIES ---
  missingLyrics?: number;
  missingReviews?: number;
  missingChartData?: number;
  missingSimilar?: number;
  missingContext?: number;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
  finalized_fields?: string[];
  last_reviewed_at?: string;
  enriched_metadata?: Record<string, unknown>; // New JSONB column
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
  
  // Helper: Strip protocol, query params, trailing slash, lowercase
  const clean = (s: unknown) => String(s).trim().toLowerCase()
    .replace(/^https?:\/\//, '') // Ignore http vs https
    .replace(/\/+$/, '')         // Ignore trailing slashes
    .split('?')[0];              // Ignore query params (common in images)

  if (Array.isArray(val)) {
    const validItems = val.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (validItems.length === 0) return '';
    return JSON.stringify(validItems.map(clean).sort());
  }
  
  if (typeof val === 'object') return JSON.stringify(val);
  return clean(val);
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
  const [batchSize, setBatchSize] = useState('10');
  const [autoSnooze, setAutoSnooze] = useState(true); // Default to true (30-day skip)
  
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
      whosampled: activeServices.has('whosampled'),
      secondhandsongs: activeServices.has('secondhandsongs'),
      theaudiodb: activeServices.has('theaudiodb'),
      wikidata: activeServices.has('wikidata'),
      setlistfm: activeServices.has('setlistfm'),
      rateyourmusic: activeServices.has('rateyourmusic'),
      fanarttv: activeServices.has('fanarttv'),
      deezer: activeServices.has('deezer'),
      musixmatch: activeServices.has('musixmatch'),
      popsike: activeServices.has('popsike'),
      pitchfork: activeServices.has('pitchfork'),
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
          limit: specificAlbumIds ? undefined : 5, // Reduced to prevent timeouts
          cursor: specificAlbumIds ? undefined : cursorRef.current,
          // FIXED: Renamed folder to location in API call if necessary, or just don't pass it if it's dead
          // Assuming the API expects 'folder' to filter by location:
          location: folderFilter || undefined, 
          services: getServicesForSelection(),
          autoSnooze: autoSnooze // PASSED TO SERVER
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
          // This is fine, logs empty results if any
        }

        if (candidates.length === 0 && hasMoreRef.current === false) {
          break; 
        }

        const { conflicts: batchConflicts, summary: batchSummaryItems } = await processBatchAndSave(candidates);
        
        collectedConflicts = [...collectedConflicts, ...batchConflicts];
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
    
    const GLOBAL_PRIORITY = [
      'discogs', 'musicbrainz', 'spotify', 'appleMusic', 'deezer', 
      'rateyourmusic', 'lastfm', 'theaudiodb', 'wikipedia', 'wikidata', 
      'coverArt', 'fanarttv', 
      'genius', 'musixmatch', 
      'whosampled', 'secondhandsongs', 'setlistfm', 
      'popsike', 'pitchfork'
    ];
    
    const STATIC_PRIORITY = ['discogs', 'musicbrainz', 'spotify', 'appleMusic', 'deezer', 'wikidata'];
    const SONIC_PRIORITY = ['spotify', 'acousticbrainz', 'musicbrainz'];

    const localBatchSummary: {album: string, field: string, action: string}[] = [];

    results.forEach((item) => {
      processedIds.push(item.album.id);
      const { album, candidates } = item;
      
      const foundKeys = new Set<string>();
      Object.values(candidates).forEach((c) => {
        if (c && typeof c === 'object') {
          Object.keys(c as Record<string, unknown>).forEach(k => foundKeys.add(k));
        }
      });
      
      if (foundKeys.size > 0) {
         const summary = Array.from(foundKeys)
            .filter(k => !['artist', 'title'].includes(k))
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
            
            const allowedSources = fieldConfig[key];
            if (!allowedSources) return; 

            let normalizedSource = source;
            if (source === 'appleMusicEnhanced') normalizedSource = 'appleMusic';
            if (source === 'coverArt') normalizedSource = 'coverArtArchive';
            
            if (!allowedSources.has(normalizedSource)) return; 

            if (['bpm', 'key', 'time_signature'].includes(key)) return;

            const finalized = (album as Record<string, unknown>).finalized_fields as string[] | undefined;
            if (Array.isArray(finalized) && finalized.includes(key)) return;

            // CLIENT SIDE CHECK (Still useful for specific fields)
            if (autoSnooze) {
               const lastReviewed = (album as Record<string, unknown>).last_reviewed_at as string | undefined;
               if (lastReviewed) {
                  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                  if (new Date(lastReviewed).getTime() > thirtyDaysAgo) return; 
               }
            }

            const alreadySeen = (resolutions as ResolutionHistory[] | null)?.some(r => 
               r.album_id === album.id && r.field_name === key && r.source === source
            );
            if (alreadySeen) return; 

            // *** REDIRECT 'NOTES' TO ENRICHED_METADATA ***
            if (key === 'notes' && value) {
               // We don't want to conflict with the 'notes' column (which is personal).
               // We map it to 'enriched_metadata' instead.
               if (!fieldCandidates['enriched_metadata']) fieldCandidates['enriched_metadata'] = {};
               // Store it keyed by source
               fieldCandidates['enriched_metadata'][source] = value;
               return; 
            }

            let newVal = value;
            if (key === 'original_release_date' && typeof newVal === 'string') {
                 if (/^\d{4}$/.test(newVal)) newVal = `${newVal}-12-25`;
                 if (!isValidDate(newVal)) return;
            }
            
            if (newVal !== null && newVal !== undefined && newVal !== '') {
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
          
          const isCurrentEmpty = !currentVal || 
            (Array.isArray(currentVal) && (
               currentVal.length === 0 || 
               currentVal.every(v => !v || String(v).trim() === '')
            )) ||
            (typeof currentVal === 'string' && currentVal.trim() === '') ||
            (typeof currentVal === 'object' && Object.keys(currentVal as object).length === 0);

          const sources = Object.keys(sourceValues);
          if (sources.length === 0) return;

          const ARRAY_FIELDS = ['genres', 'styles', 'musicians', 'producers', 'engineers', 'songwriters'];
          const isArrayField = ARRAY_FIELDS.includes(key);

          let proposedValue: unknown;
          let isMerge = false;

          // Special Handling for 'enriched_metadata'
          if (key === 'enriched_metadata') {
             // Pass the full source map to the review modal
             proposedValue = sourceValues;
             isMerge = true;
          }
          else if (isArrayField) {
             const mergedSet = new Set<string>();
             const lowerCaseMap = new Set<string>();
             
             Object.values(sourceValues).forEach(val => {
                if (Array.isArray(val)) {
                   val.forEach(item => {
                      const str = String(item).trim();
                      const lower = str.toLowerCase().replace(/[^a-z0-9]/g, ''); 
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
          else if (key === 'notes') {
              // Should not happen due to redirect, but safe fallback
              proposedValue = Object.values(sourceValues)[0];
          }
          else if (key === 'enrichment_summary') {
             const combinedSummary: Record<string, string> = {};
             if (currentVal && typeof currentVal === 'object') {
                Object.assign(combinedSummary, currentVal);
             }
             Object.values(sourceValues).forEach(val => {
                if (typeof val === 'object' && val !== null) {
                   Object.assign(combinedSummary, val);
                }
             });
             proposedValue = combinedSummary;
             isMerge = true; 
          }
          else {
             let priorityList = GLOBAL_PRIORITY;
             if (['original_release_date', 'year', 'tracklist', 'labels', 'cat_no', 'country', 'barcode'].includes(key)) {
                priorityList = STATIC_PRIORITY;
             } else if (['tempo_bpm', 'musical_key', 'energy', 'danceability'].includes(key)) {
                priorityList = SONIC_PRIORITY;
             }

             let winnerSrc = priorityList.find(s => sources.includes(s)) || sources[0];

             if (album.discogs_release_id && sources.includes('discogs')) {
                if (['tracklist', 'labels', 'cat_no', 'country', 'barcode', 'format'].includes(key)) {
                   winnerSrc = 'discogs';
                }
             }

             proposedValue = sourceValues[winnerSrc];
          }

          if (proposedValue === null || proposedValue === undefined || proposedValue === '') return;
          
          if (Array.isArray(proposedValue)) {
             const filtered = proposedValue.filter(v => v && String(v).trim() !== '');
             if (filtered.length === 0) return;
             proposedValue = filtered;
          }
          
          if (typeof proposedValue === 'object' && Object.keys(proposedValue as object).length === 0) return;

          const uniqueSingleValues = new Set(Object.values(sourceValues).map(v => normalizeValue(v)));
          const singleValuesAgree = !isArrayField && uniqueSingleValues.size === 1;

          if (isCurrentEmpty && (isMerge || singleValuesAgree)) {
              if (key === 'enriched_metadata') {
                 // Auto-fill logic for metadata
                 const base = (currentVal as Record<string, unknown>) || {};
                 const newMeta = { ...base };
                 Object.entries(sourceValues).forEach(([src, txt]) => {
                     if (src === 'wikipedia') newMeta['wiki_bio'] = txt;
                     if (src === 'discogs') newMeta['media_notes'] = txt;
                     if (src === 'allmusic') newMeta['review'] = txt;
                     else newMeta[`${src}_notes`] = txt;
                 });
                 updatesForAlbum[key] = newMeta;
                 autoFilledFields.push(key);
              } else {
                 updatesForAlbum[key] = proposedValue;
                 autoFilledFields.push(key);
              }
              
              sources.forEach(src => {
                 historyUpdates.push({
                    album_id: album.id, field_name: key, source: src, resolution: 'use_new', kept_value: proposedValue, resolved_at: new Date().toISOString()
                 });
              });
          } 
          else {
              if (key === 'tracks' && !isCurrentEmpty) return;
              if (autoFilledFields.includes(key)) return;

              if (!areValuesEqual(currentVal, proposedValue)) {
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
                      candidates: sourceValues,
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

      // ALWAYS update timestamps, even if no conflicts, to prevent infinite loops
      const timestamp = new Date().toISOString();
      // FIX: Mark as reviewed even if we only found "No Conflicts"
      const hasConflicts = newConflicts.some(c => c.album_id === album.id);
      if (!hasConflicts) {
          updatesForAlbum.last_reviewed_at = timestamp;
      }

      if (Object.keys(updatesForAlbum).length > 0) {
        autoUpdates.push({ id: album.id, fields: updatesForAlbum });
        
        autoFilledFields.forEach(field => {
          const val = updatesForAlbum[field];
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
        });
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

    // FINAL SAFETY: Update any touched IDs that weren't caught in autoUpdates
    // This ensures albums with "No Data Found" still get their timestamps updated so they don't loop.
    const changedIds = new Set(autoUpdates.map(u => u.id));
    // Also include albums that have pending conflicts (we don't want to auto-timestamp them yet)
    newConflicts.forEach(c => changedIds.add(c.album_id));
    
    const untouchedIds = processedIds.filter(id => !changedIds.has(id));
    
    if (untouchedIds.length > 0) {
      const now = new Date().toISOString();
      await supabase.from('collection')
        .update({ last_reviewed_at: now }) // Mark as reviewed!
        .in('id', untouchedIds);
    }

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
         if (match.tempo_bpm) patch.tempo_bpm = match.tempo_bpm;
         if (match.musical_key) patch.musical_key = match.musical_key;
         if (match.lyrics) patch.lyrics = match.lyrics;
         
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

  // --- NEW: SKIP HANDLER (SNOOZE) ---
  async function handleSkip(albumId: number) {
    const timestamp = new Date().toISOString();
    await supabase.from('collection').update({ last_reviewed_at: timestamp }).eq('id', albumId);
    
    setConflicts(prev => {
        const nextQueue = prev.filter(c => c.album_id !== albumId);
        if (nextQueue.length === 0) {
             if (isLoopingRef.current && hasMoreRef.current) {
                 setStatus('Scanning for the next batch of reviews...');
                 setTimeout(() => runScanLoop(), 500);
             } else {
                 setShowReview(false);
                 setStatus('All conflicts resolved or skipped.');
                 if (onImportComplete) onImportComplete();
                 loadStats();
             }
        }
        return nextQueue;
    });
  }

  async function handleSingleAlbumSave(
    resolutions: Record<string, { value: unknown; source: string; selectedSources?: string[] }>,
    finalizedFields: Record<string, boolean>,
    albumId: number
  ) {
    const updates: Record<string, unknown> = {};
    const resolutionRecords: Record<string, unknown>[] = [];
    const timestamp = new Date().toISOString();
    const trackSavePromises: Promise<number>[] = [];

    // 1. Process resolutions
    Object.keys(resolutions).forEach((key) => {
        if (!key.startsWith(`${albumId}-`)) return;
        
        const fieldName = key.split('-').slice(1).join('-');
        const decision = resolutions[key];
        
        updates[fieldName] = decision.value;

        const conflict = conflicts.find(c => c.album_id === albumId && c.field_name === fieldName);
        if (conflict && conflict.candidates) {
             Object.entries(conflict.candidates).forEach(([src]) => {
                const isChosenSource = decision.source === src || decision.selectedSources?.includes(src);
                const isMerge = decision.source === 'custom_merge';
                resolutionRecords.push({
                    album_id: albumId, 
                    field_name: fieldName,
                    source: src, 
                    resolution: isChosenSource ? (isMerge ? 'merge' : 'use_new') : 'keep_current',
                    kept_value: decision.value ?? conflict.current_value,
                    resolved_at: timestamp
                });
             });
             
             const trackSource = (decision.source === 'current' || decision.source === 'merge' || decision.source === 'custom_merge') ? null : decision.source;
             if (trackSource && conflict.candidates[trackSource]) {
                const cand = conflict.candidates[trackSource] as { tracks?: unknown[] };
                if (cand.tracks) {
                    trackSavePromises.push(saveTrackData(albumId, cand.tracks));
                }
             }
        }
    });

    // 2. Process Finalized Fields
    Object.keys(finalizedFields).forEach((key) => {
        if (!key.startsWith(`${albumId}-`) || !finalizedFields[key]) return;
        const fieldName = key.split('-').slice(1).join('-');
        
        const conflict = conflicts.find(c => c.album_id === albumId && c.field_name === fieldName);
        const currentList = conflict?.existing_finalized || [];
        if (!currentList.includes(fieldName)) {
            const existing = (updates.finalized_fields as string[]) || currentList;
            updates.finalized_fields = [...new Set([...existing, fieldName])];
        }
    });

    // 3. Database Updates
    if (Object.keys(updates).length > 0) {
        updates.last_reviewed_at = timestamp;

        ['labels', 'genres', 'styles', 'finalized_fields', 'enrichment_sources'].forEach(field => {
            if (updates[field] !== undefined && !Array.isArray(updates[field])) {
                updates[field] = [updates[field]];
            }
        });

        const { error } = await supabase.from('collection').update(updates).eq('id', albumId);
        if (error) {
            console.error(`Failed to save album ${albumId}:`, error);
            addLog(String(albumId), 'skipped', `Save Error: ${error.message}`);
            return;
        }
    } else {
        await supabase.from('collection').update({ last_reviewed_at: timestamp }).eq('id', albumId);
    }

    if (resolutionRecords.length > 0) {
        await supabase.from('import_conflict_resolutions').upsert(resolutionRecords, { 
            onConflict: 'album_id,field_name,source' 
        });
    }

    await Promise.all(trackSavePromises);

    // 4. Remove from Queue
    setConflicts(prev => {
        const nextQueue = prev.filter(c => c.album_id !== albumId);
        
        if (nextQueue.length === 0) {
             if (isLoopingRef.current && hasMoreRef.current) {
                 setStatus('Scanning for the next batch of reviews...');
                 setTimeout(() => runScanLoop(), 500);
             } else {
                 setShowReview(false);
                 setStatus('All conflicts resolved.');
                 if (onImportComplete) onImportComplete();
                 loadStats();
             }
        }
        return nextQueue;
    });
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
        batchSummary={batchSummary}
        statusMessage={status}
        onSave={handleSingleAlbumSave}
        onSkip={handleSkip}
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
      <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[10000]">
        <div className="bg-white p-8 rounded-xl w-[500px] text-gray-900">
          <h3 className="mb-4 font-bold text-lg">Batch Review Summary</h3>
          <div className="max-h-[300px] overflow-y-auto border border-gray-200 mb-5 rounded-md">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2.5 border-b border-gray-200">Album / Field</th>
                  <th className="p-2.5 border-b border-gray-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {batchSummary.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-none">
                    <td className="p-2.5">
                      <div className="font-semibold text-gray-900">{s.album}</div>
                      <div className="text-gray-500 text-[11px]">{s.field.replace(/_/g, ' ').toUpperCase()}</div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                        s.action.includes('Auto') ? 'bg-emerald-50 text-emerald-700' : 
                        s.action.includes('No') ? 'bg-red-50 text-red-800' : 
                        'bg-blue-50 text-blue-700'
                      }`}>
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
            className="w-full bg-[#4FC3F7] text-white border-none py-3 rounded-md text-[15px] font-medium cursor-pointer shadow hover:bg-[#29B6F6] hover:shadow-md transition-all"
          >
            Continue to Next Batch
          </button>
        </div>
      </div>
    );
  }

  // --- UPDATED CONFIG WITH NEW CATEGORIES ---
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
    { category: 'lyrics', count: stats.missingLyrics || 0, subcounts: [] },
    { category: 'reviews', count: stats.missingReviews || 0, subcounts: [] },
    { category: 'chart_data', count: stats.missingChartData || 0, subcounts: [] },
    { category: 'cultural_context', count: stats.missingContext || 0, subcounts: [] },
    { category: 'similar_albums', count: stats.missingSimilar || 0, subcounts: [] },
  ] : [];

  return (
    <div className="fixed inset-0 bg-white z-[10000] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto bg-white p-6">
        <div className="w-[1200px] max-w-[95vw] h-[90vh] mx-auto flex flex-col overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl">
        
        {/* HEADER */}
        <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
          <h2 className="text-base font-medium text-white">⚡ Collection Data Enrichment</h2>
          <button onClick={onClose} disabled={enriching} className="bg-transparent border-none text-white text-[28px] cursor-pointer leading-none p-0 hover:text-gray-300">×</button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="text-center p-10">Loading statistics...</div>
          ) : stats ? (
            <>
              {/* 1. OVERVIEW STATS */}
              <div className="mb-6">
                <h3 className="text-base font-semibold mb-3">Collection Overview</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Total Albums" value={stats.total} color="#3b82f6" onClick={() => {}} disabled />
                  <StatBox label="Fully Enriched" value={stats.fullyEnriched} color="#10b981" onClick={() => showCategory('fully-enriched', 'Fully Enriched')} />
                  <div className="relative">
                    <StatBox label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" onClick={() => showCategory('needs-enrichment', 'Needs Enrichment')} />
                    {/* AUTO-SNOOZE TOGGLE */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setAutoSnooze(!autoSnooze); }}
                      className={`absolute -top-2.5 right-2.5 px-2 py-0.5 rounded-xl text-[10px] border font-bold cursor-pointer transition-all ${
                        autoSnooze 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                      title={autoSnooze ? "Skipping items reviewed in last 30 days" : "Checking ALL items (ignoring recent reviews)"}
                    >
                      {autoSnooze ? '💤 Snooze Active' : '⚡ Snooze OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. DATA CATEGORY SELECTION */}
              <div className="bg-white border-2 border-[#D8D8D8] rounded-md p-5 mb-6">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold text-green-700 mb-2">Select Data to Enrich</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-3">
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
              <div className="bg-white border-2 border-[#D8D8D8] rounded-md p-5 mb-6 flex gap-4 flex-wrap items-center">
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-sm">Folder:</label>
                  <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} disabled={enriching} className="p-1.5 rounded border border-gray-300 text-gray-900">
                    <option value="">All Folders</option>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="font-semibold text-sm text-gray-900">Batch Size:</label>
                  <select value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={enriching} className="p-1.5 rounded border border-gray-300 text-gray-900">
                    <option value="10">10 (Safe)</option>
                    <option value="25">25 (Standard)</option>
                  </select>
                </div>
              </div>

              {/* 4. SESSION LOG */}
              {sessionLog.length > 0 && (
                <div className="mb-4 border border-gray-200 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700">
                    Session Activity ({sessionLog.length})
                  </div>
                  <div className="max-h-[150px] overflow-y-auto p-2 bg-white">
                    {sessionLog.map(log => (
                      <div key={log.id} className="text-xs mb-1 flex gap-2">
                        <span className="text-gray-400">{log.timestamp.toLocaleTimeString()}</span>
                        <span className={`font-semibold ${log.action === 'auto-fill' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {log.action === 'auto-fill' ? '✅' : '✏️'}
                        </span>
                        <span className="flex-1 text-gray-900">
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
                <div className="p-3 rounded-md mb-4 bg-emerald-100 text-emerald-800 font-medium">
                  {status}
                </div>
              )}
            </>
          ) : (
            <div className="bg-red-50 border-2 border-red-400 rounded-md p-4 text-red-700 text-sm mt-6">Failed to load statistics.</div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-200 flex justify-center gap-3">
          <button 
            onClick={onClose} 
            disabled={enriching} 
            className="bg-white text-gray-900 border-2 border-[#D8D8D8] px-8 py-3 rounded-md text-[15px] font-medium cursor-pointer transition-all hover:border-[#4FC3F7] hover:bg-[#F0F9FF]"
          >
            Close
          </button>
          <button 
            onClick={() => startEnrichment()} 
            disabled={enriching || !stats || Object.keys(fieldConfig).length === 0} 
            className={`text-white border-none px-8 py-3 rounded-md text-[15px] font-medium cursor-pointer shadow transition-all ${
              enriching 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-[#4FC3F7] hover:bg-[#29B6F6] hover:shadow-md'
            }`}
          >
            {enriching ? 'Scanning...' : '⚡ Start Scan & Review'}
          </button>
        </div>
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[10000]">
           <div className="flex items-center justify-center p-6 w-full h-full">
            <div className="bg-white rounded-lg w-[1000px] max-w-[90vw] max-h-[90vh] flex flex-col overflow-hidden text-gray-900">
            <div className="bg-[#2A2A2A] text-white px-6 py-3.5 flex items-center justify-between shrink-0">
              <h3 className="text-base font-medium">{categoryTitle}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="bg-transparent border-none text-white text-[28px] cursor-pointer leading-none p-0 hover:text-gray-300">×</button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {loadingCategory ? (
                <div className="text-center p-10">Loading...</div>
              ) : (
                <>
                  <button 
                     onClick={() => startEnrichment(categoryAlbums.map(a => a.id))}
                     disabled={enriching || categoryAlbums.length === 0}
                     className="w-full bg-[#4FC3F7] text-white border-none py-3 rounded-md text-[15px] font-medium cursor-pointer shadow hover:bg-[#29B6F6] hover:shadow-md transition-all mb-4 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Scan These {categoryAlbums.length} Albums
                  </button>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                    {categoryAlbums.map(album => (
                      <div key={album.id} className="border border-gray-200 rounded-md p-2">
                        <div className="relative w-full aspect-square mb-1.5 bg-gray-100">
                           {album.image_url && <Image src={album.image_url} alt="" fill style={{ objectFit: 'cover' }} unoptimized />}
                        </div>
                        <div className="font-semibold text-[11px] whitespace-nowrap overflow-hidden text-gray-900">{album.title}</div>
                        <div className="text-gray-500 text-[11px] whitespace-nowrap overflow-hidden">{album.artist}</div>
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
    <div onClick={disabled ? undefined : onClick} className="bg-white rounded-md p-5 text-center" style={{ border: `2px solid ${color}`, cursor: disabled ? 'default' : 'pointer' }}>
      <div className="text-3xl font-bold mb-1" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
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
    <div className={`w-full text-left bg-white border-2 border-[#D8D8D8] rounded-md p-5 transition-all duration-200 ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-[#4FC3F7] hover:bg-[#F0F9FF]'}`}>
      {/* HEADER */}
      <div 
        className="flex items-center gap-2 pb-2 border-b border-gray-200 mb-2"
      >
         <input 
            type="checkbox" 
            checked={isAllSelected}
            ref={el => { if(el) el.indeterminate = isIndeterminate; }}
            onChange={onToggleCategory}
            disabled={disabled}
            className="cursor-pointer"
         />
         <span className="text-base">{DATA_CATEGORY_ICONS[category]}</span>
         <span className="text-base font-semibold text-[#1a1a1a]">{DATA_CATEGORY_LABELS[category]}</span>
      </div>

      {/* FIELD ROWS (Dashboard Style) */}
      <div className="flex flex-col gap-2">
         {validFields.map(field => {
            const isEnabled = !!fieldConfig[field];
            const activeSources = fieldConfig[field] || new Set();
            const services = FIELD_TO_SERVICES[field] || [];
            const missing = getMissing(field);

            return (
               <div key={field} className={isEnabled ? "p-2 bg-blue-50 border border-blue-200 rounded" : "p-2 border border-transparent"}>
                  {/* Row Top: Checkbox + Name + Stats */}
                  <div className="flex items-center justify-between">
                     <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                        <input 
                           type="checkbox" 
                           checked={isEnabled} 
                           onChange={() => onToggleField(field)}
                           disabled={disabled}
                        />
                        {formatLabel(field)}
                     </label>
                     {missing > 0 && <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">{missing}</span>}
                  </div>

                  {/* Row Bottom: Source Toggles (Only if enabled) */}
                  {isEnabled && services.length > 0 && (
                     <div className="flex flex-wrap gap-1.5 ml-5 mt-1">
                        {services.map(srv => {
                           const isActive = activeSources.has(srv);
                           return (
                              <label 
                                key={srv} 
                                title={srv}
                                className={`flex items-center px-1.5 py-0.5 rounded border text-[10px] cursor-pointer select-none transition-colors ${
                                  isActive 
                                    ? "bg-white border-blue-400 text-blue-700 shadow-sm" 
                                    : "bg-gray-100 border-gray-200 text-gray-500 opacity-60 hover:opacity-100"
                                }`}
                              >
                                 <input 
                                    type="checkbox" 
                                    checked={isActive} 
                                    onChange={() => onToggleFieldSource(field, srv)}
                                    disabled={disabled}
                                    className="hidden"
                                 />
                                 <span>{SERVICE_ICONS[srv as EnrichmentService]}</span>
                                 <span className="ml-1">{srv}</span>
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
