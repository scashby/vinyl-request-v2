// src/app/edit-collection/components/ImportEnrichModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { supabase } from 'lib/supabaseClient';
import ConflictResolutionModal from './ConflictResolutionModal';
import { type FieldConflict } from 'lib/conflictDetection';

// --- 1. DATA CATEGORY DEFINITIONS ---
export type DataCategory = 
  | 'artwork' | 'credits' | 'tracklists' | 'audio_analysis' 
  | 'genres' | 'streaming_links' | 'release_metadata';

const DATA_CATEGORY_CONFIG: Record<DataCategory, { label: string; desc: string; icon: string; services: string[] }> = {
  artwork: {
    label: 'Artwork & Images',
    desc: 'Front covers, back covers, spine images, and inner sleeves.',
    icon: '🖼️',
    // Removed 'discogs' - leveraging CoverArtArchive, Spotify, Apple
    services: ['coverArt', 'spotify', 'appleMusic']
  },
  credits: {
    label: 'Credits & Personnel',
    desc: 'Musicians, producers, engineers, and songwriters.',
    icon: '👥',
    // Removed 'discogs' - leveraging MusicBrainz, Wikipedia
    services: ['musicbrainz', 'wikipedia']
  },
  tracklists: {
    label: 'Tracklists & Durations',
    desc: 'Complete track listings, disk sides, and track durations.',
    icon: '📝',
    // Removed 'discogs' - leveraging Streaming services
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
    // Removed 'discogs' - leveraging Last.fm, Spotify
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
    // Removed 'Catalog numbers' from description
    desc: 'Barcodes, record labels, and original release dates.',
    icon: '💿',
    // Removed 'discogs' - using MB for canonical dates/labels
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

// --- 3. MAIN COMPONENT ---
export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [batchSize, setBatchSize] = useState('25');
  
  // Selection State
  const [selectedCategories, setSelectedCategories] = useState<Set<DataCategory>>(new Set([
    'artwork', 'credits', 'tracklists', 'genres'
  ]));
  
  // Drill-down Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  
  // Review & Logs
  const [showReview, setShowReview] = useState(false);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [sessionLog, setSessionLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

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

    setEnriching(true);
    setStatus('Scanning for missing data...');
    setConflicts([]);

    try {
      const payload = {
        albumIds: specificAlbumIds,
        limit: specificAlbumIds ? undefined : parseInt(batchSize),
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

      if (!result.results || result.results.length === 0) {
        setStatus('No new data found for these albums.');
        setEnriching(false);
        return;
      }

      await processCandidates(result.results);

    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setEnriching(false);
    }
  }

  async function processCandidates(results: CandidateResult[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoUpdates: { id: number; fields: Record<string, any> }[] = [];
    const newConflicts: FieldConflict[] = [];
    let filledCount = 0;

    results.forEach((item) => {
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
        if (key.endsWith('_id') || key.endsWith('_url')) {
            updatesForAlbum[key] = value;
            return;
        }

        const currentVal = album[key];
        const newVal = value;
        const isCurrentEmpty = !currentVal || (Array.isArray(currentVal) && currentVal.length === 0);
        const isDifferent = JSON.stringify(currentVal) !== JSON.stringify(newVal);

        if (isCurrentEmpty && newVal) {
           updatesForAlbum[key] = newVal;
           autoFilledFields.push(key);
           filledCount++;
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
              cat_no: album.cat_no as string,
              barcode: album.barcode as string,
              labels: (album.labels as string[]) || []
           });
        }
      });

      if (Object.keys(updatesForAlbum).length > 0) {
        autoUpdates.push({ id: album.id, fields: updatesForAlbum });
        if (autoFilledFields.length > 0) {
          addLog(`${album.artist} - ${album.title}`, 'auto-fill', `Added: ${autoFilledFields.join(', ')}`);
        }
      }
    });

    if (autoUpdates.length > 0) {
      setStatus(`Auto-filling ${filledCount} missing fields...`);
      await Promise.all(autoUpdates.map(u => 
        supabase.from('collection').update(u.fields).eq('id', u.id)
      ));
    }

    setEnriching(false);

    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      setShowReview(true);
      setStatus(autoUpdates.length > 0 ? `Auto-filled ${filledCount} fields. Reviewing ${newConflicts.length} conflicts.` : `Review required for ${newConflicts.length} items.`);
    } else {
      setStatus(autoUpdates.length > 0 ? `✅ Success! Auto-filled ${filledCount} missing fields.` : 'Analysis complete. No better data found.');
      if (autoUpdates.length > 0) loadStats();
    }
  }

  async function handleApplyChanges() {
    setShowReview(false);
    setShowCategoryModal(false);
    conflicts.forEach(c => {
       addLog(`${c.artist} - ${c.title}`, 'conflict-resolved', `Updated ${c.field_name}`);
    });
    setStatus('✅ Updates applied successfully!');
    await loadStats(); 
    if (onImportComplete) onImportComplete();
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
      <ConflictResolutionModal 
        conflicts={conflicts} 
        source="discogs" 
        onComplete={handleApplyChanges}
        onCancel={() => { setShowReview(false); setStatus('Review cancelled.'); }}
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
    { category: 'release_metadata', count: stats.missingReleaseMetadata }, // Removed catalog # subcount
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

// --- SUB-COMPONENTS ---

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