// src/app/edit-collection/components/ImportEnrichModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';
import EnrichmentReviewModal from './EnrichmentReviewModal';
import { type FieldConflict } from 'lib/conflictDetection';

export type DataCategory = 
  | 'artwork' | 'credits' | 'tracklists' | 'audio_analysis' 
  | 'genres' | 'streaming_links' | 'release_metadata';

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

// --- HELPER: ROBUST EQUALITY CHECK ---
// Handles string vs number ("1999" vs 1999), array order, and null/undefined
const areValuesEqual = (a: unknown, b: unknown): boolean => {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return true;
  if (!a || !b) return a === b;

  if (typeof a !== 'object' && typeof b !== 'object') {
    return String(a).trim() === String(b).trim();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort().map(val => (typeof val === 'object' ? JSON.stringify(val) : String(val)));
    const sortedB = [...b].sort().map(val => (typeof val === 'object' ? JSON.stringify(val) : String(val)));
    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  }

  return JSON.stringify(a) === JSON.stringify(b);
};

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
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [sessionLog, setSessionLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const hasMoreRef = useRef(true);
  const isLoopingRef = useRef(false);
  const cursorRef = useRef(0);

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

  async function startEnrichment(specificAlbumIds?: number[]) {
    if (selectedCategories.size === 0) {
      alert('Please select at least one data category');
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
    let collectedConflicts: FieldConflict[] = [];

    while ((collectedConflicts.length < targetConflicts || specificAlbumIds) && hasMoreRef.current) {
      setStatus(`Scanning (Cursor: ${cursorRef.current})... Found ${collectedConflicts.length}/${targetConflicts} conflicts to review.`);

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

        if (candidates.length === 0 && hasMoreRef.current === false) {
          break;
        }

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
    const albumIds = results.map(r => r.album.id);
    const { data: resolutions, error: resError } = await supabase
      .from('import_conflict_resolutions')
      .select('album_id, field_name, rejected_value')
      .in('album_id', albumIds)
      .eq('source', 'discogs');
      
    if (resError) console.error('Error fetching history:', resError);

    const ALLOWED_COLUMNS = new Set([
      'artist', 'title', 'year', 'format', 'country', 'barcode', 'labels',
      'tracklists', 'image_url', 'back_image_url', 'sell_price', 'media_condition', 'folder',
      'discogs_master_id', 'discogs_release_id', 'spotify_id', 'spotify_url',
      'apple_music_id', 'apple_music_url', 
      'genres', 'styles',
      'musicians', 'credits', 'producers'
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoUpdates: { id: number; fields: Record<string, any> }[] = [];
    const newConflicts: FieldConflict[] = [];
    const processedIds: number[] = [];

    results.forEach((item) => {
      processedIds.push(item.album.id);
      const { album, candidates } = item;
      if (Object.keys(candidates).length === 0) return;

      const combined = { 
        ...candidates.musicbrainz as object, ...candidates.appleMusic as object, ...candidates.lastfm as object, 
        ...candidates.spotify as object, ...candidates.discogs as object, ...candidates.coverArt as object, 
        ...candidates.wikipedia as object, ...candidates.genius as object 
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatesForAlbum: Record<string, any> = {};
      const autoFilledFields: string[] = [];

      Object.entries(combined).forEach(([key, value]) => {
        if (!ALLOWED_COLUMNS.has(key)) return;

        const currentVal = album[key];
        const newVal = value;

        if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
             if (!['musicians', 'producers', 'engineers', 'writers', 'credits'].includes(key)) return;
        }

        const isCurrentEmpty = !currentVal || (Array.isArray(currentVal) && currentVal.length === 0);
        // Use ROBUST EQUALITY CHECK
        const isDifferent = !areValuesEqual(currentVal, newVal);

        // CHECK HISTORY - Use ROBUST EQUALITY CHECK
        const previouslyRejected = resolutions?.some(r => 
          r.album_id === album.id && 
          r.field_name === key && 
          areValuesEqual(r.rejected_value, newVal) 
        );

        if (previouslyRejected) return;

        if (isCurrentEmpty && newVal) {
           updatesForAlbum[key] = newVal;
           autoFilledFields.push(key);
        } else if (isDifferent) {
           newConflicts.push({
              album_id: album.id,
              field_name: key,
              current_value: currentVal,
              new_value: newVal,
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
      });

      if (Object.keys(updatesForAlbum).length > 0) {
        updatesForAlbum.last_enriched_at = new Date().toISOString();
        autoUpdates.push({ id: album.id, fields: updatesForAlbum });
        if (autoFilledFields.length > 0) {
          addLog(`${album.artist} - ${album.title}`, 'auto-fill', `Added: ${autoFilledFields.join(', ')}`);
        }
      }
    });

    if (autoUpdates.length > 0) {
      await Promise.all(autoUpdates.map(u => 
        supabase.from('collection').update(u.fields).eq('id', u.id)
      ));
    }

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

  async function handleApplyChanges() {
    const updatesByAlbum: Record<number, Record<string, unknown>> = {};
    const resolutionRecords: Record<string, unknown>[] = [];
    const timestamp = new Date().toISOString();
    
    const involvedAlbumIds = new Set<number>();

    conflicts.forEach(c => {
      involvedAlbumIds.add(c.album_id);
      
      const userChoseNew = !areValuesEqual(c.new_value, c.current_value);
      const chosenValue = c.new_value;
      
      if (userChoseNew) {
        if (!updatesByAlbum[c.album_id]) updatesByAlbum[c.album_id] = {};
        updatesByAlbum[c.album_id][c.field_name] = chosenValue;
      }

      resolutionRecords.push({
        album_id: c.album_id,
        field_name: c.field_name,
        kept_value: chosenValue,
        rejected_value: userChoseNew ? c.current_value : c.new_value, 
        resolution: userChoseNew ? 'use_new' : 'keep_current',
        source: 'discogs',
        resolved_at: timestamp
      });
    });

    console.log('[DB SAVE] Starting Batch Save...');
    console.log(`[DB SAVE] Updates Pending: ${Object.keys(updatesByAlbum).length} albums`);
    console.log(`[DB SAVE] History Records: ${resolutionRecords.length}`);

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
      else console.log(`[DB SUCCESS] Updated album ${albumId}`);
    });

    if (resolutionRecords.length > 0) {
      const { error: histError } = await supabase
        .from('import_conflict_resolutions')
        .upsert(resolutionRecords, { onConflict: 'album_id,field_name,source' });
        
      if (histError) console.error('[DB ERROR] Failed to save history:', histError);
      else console.log('[DB SUCCESS] Resolution history saved.');
    }

    await Promise.all(updatePromises);

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
          isLoopingRef.current = false; 
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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        width: '1200px', 
        maxWidth: '95vw', 
        maxHeight: '95vh', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        color: '#111827'
      }}>
        
        {/* HEADER */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f59e0b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'white' }}>⚡ Collection Data Enrichment</h2>
          <button onClick={onClose} disabled={enriching} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading statistics...</div>
          ) : stats ? (
            <>
              {/* 1. OVERVIEW STATS */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>Collection Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <StatBox label="Total Albums" value={stats.total} color="#3b82f6" onClick={() => {}} disabled />
                  <StatBox label="Fully Enriched" value={stats.fullyEnriched} color="#10b981" onClick={() => showCategory('fully-enriched', 'Fully Enriched')} />
                  <StatBox label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" onClick={() => showCategory('needs-enrichment', 'Needs Enrichment')} />
                </div>
              </div>

              {/* 2. DATA CATEGORY SELECTION */}
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>Select Data to Enrich</h3>
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
              <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
            <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>Failed to load statistics.</div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} disabled={enriching} style={{ padding: '8px 16px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', color: '#374151' }}>Close</button>
          <button 
            onClick={() => startEnrichment()} 
            disabled={enriching || !stats || selectedCategories.size === 0} 
            style={{ padding: '8px 16px', backgroundColor: enriching ? '#d1d5db' : '#f59e0b', border: 'none', borderRadius: '4px', fontWeight: '600', color: 'white', cursor: enriching ? 'not-allowed' : 'pointer' }}
          >
            {enriching ? 'Scanning...' : '⚡ Start Scan & Review'}
          </button>
        </div>
      </div>

      {/* DRILL DOWN MODAL */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', width: '1000px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#111827' }}>
            <div style={{ padding: '16px 20px', backgroundColor: '#f59e0b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'white' }}>{categoryTitle}</h3>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {loadingCategory ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
              ) : (
                <>
                  <button 
                     onClick={() => startEnrichment(categoryAlbums.map(a => a.id))}
                     disabled={enriching || categoryAlbums.length === 0}
                     style={{ marginBottom: '16px', padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', width: '100%', cursor: 'pointer' }}
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
      )}
    </div>
  );
}

function StatBox({ label, value, color, onClick, disabled }: { label: string; value: number; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{ padding: '16px', backgroundColor: 'white', border: `2px solid ${color}`, borderRadius: '6px', textAlign: 'center', cursor: disabled ? 'default' : 'pointer' }}>
      <div style={{ fontSize: '28px', fontWeight: '700', color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

function DataCategoryCard({ category, count, subcounts, selected, onToggle, disabled }: { category: DataCategory; count: number; subcounts?: { label: string; count: number }[]; selected: boolean; onToggle: () => void; disabled: boolean; }) {
  const config = DATA_CATEGORY_CONFIG[category];
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      onClick={disabled ? undefined : onToggle}
      style={{ 
        border: `2px solid ${selected ? '#f59e0b' : '#e5e7eb'}`, 
        borderRadius: '6px', 
        padding: '12px', 
        backgroundColor: selected ? '#fff7ed' : 'white', 
        cursor: disabled ? 'not-allowed' : 'pointer', 
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        gap: '10px'
      }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} disabled={disabled} style={{ marginTop: '2px', cursor: 'pointer' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px' }}>{config.icon}</span>
          <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{config.label}</span>
          <span style={{ marginLeft: 'auto', fontWeight: '700', color: count > 0 ? '#ef4444' : '#10b981' }}>{count.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>{config.desc}</div>
        
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