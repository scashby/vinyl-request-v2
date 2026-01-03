// src/app/edit-collection/components/ImportEnrichModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type EnrichmentStats = {
  total: number;
  needsEnrichment: number;
  fullyEnriched: number;
  missingDiscogsId: number;
  missingMasterId: number;
  missingImage: number;
  missingBackImage: number;
  missingGenres: number;
  missingTracklists: number;
  missingMusicians: number;
  missingProducers: number;
  missingSpotify: number;
  missingApple: number;
  missingLastFm: number;
  missingAllMusic: number;
  missingWikipedia: number;
  missingTempo: number;
  missingAudioFeatures: number;
};

type ServiceSelection = {
  musicbrainz: boolean;
  lastfm: boolean;
  spotifyEnhanced: boolean;
  appleMusicEnhanced: boolean;
  allmusic: boolean;
  wikipedia: boolean;
  coverArtArchive: boolean;
  acousticbrainz: boolean;
  discogsMetadata: boolean;
  discogsTracklist: boolean;
  genius: boolean;
};

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
};

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  musicbrainz?: { success: boolean; error?: string; skipped?: boolean };
  lastfm?: { success: boolean; error?: string; skipped?: boolean };
  spotifyEnhanced?: { success: boolean; error?: string; skipped?: boolean };
  appleMusicEnhanced?: { success: boolean; error?: string; skipped?: boolean };
  allmusic?: { success: boolean; error?: string; skipped?: boolean };
  wikipedia?: { success: boolean; error?: string; skipped?: boolean };
  coverArtArchive?: { success: boolean; error?: string; skipped?: boolean };
  acousticbrainz?: { success: boolean; error?: string; skipped?: boolean };
  discogsMetadata?: { success: boolean; error?: string; skipped?: boolean };
  discogsTracklist?: { success: boolean; error?: string; skipped?: boolean };
  genius?: { success: boolean; error?: string; skipped?: boolean };
};

export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [batchSize, setBatchSize] = useState('100');
  const [services, setServices] = useState<ServiceSelection>({
    musicbrainz: true,
    lastfm: true,
    spotifyEnhanced: true,
    appleMusicEnhanced: true,
    allmusic: true,
    wikipedia: true,
    coverArtArchive: true,
    acousticbrainz: true,
    discogsMetadata: true,
    discogsTracklist: true,
    genius: true,
  });
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryAlbums, setCategoryAlbums] = useState<Album[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [enrichingCategory, setEnrichingCategory] = useState(false);
  const [categoryResults, setCategoryResults] = useState<AlbumResult[]>([]);
  const [enrichmentResults, setEnrichmentResults] = useState<AlbumResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

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

  async function showCategory(category: string, title: string) {
    setShowCategoryModal(true);
    setCategoryTitle(title);
    setCategoryAlbums([]);
    setCategoryResults([]);
    setLoadingCategory(true);

    try {
      const res = await fetch(`/api/enrich-sources/albums?category=${category}&limit=200`);
      const data = await res.json();
      if (data.success) {
        setCategoryAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoadingCategory(false);
    }
  }

  async function enrichCategory() {
    if (categoryAlbums.length === 0) return;

    const serviceNames = Object.entries(services)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key);

    if (serviceNames.length === 0) {
      alert('Please select at least one service');
      return;
    }

    if (!confirm(`Enrich ${categoryAlbums.length} albums?\n\nServices: ${serviceNames.join(', ')}\n\nThis may take several minutes.`)) {
      return;
    }

    setEnrichingCategory(true);
    setCategoryResults([]);

    try {
      const albumIds = categoryAlbums.map(a => a.id);
      const res = await fetch('/api/enrich-sources/targeted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumIds, services })
      });

      const result = await res.json();
      if (result.success) {
        setCategoryResults(result.results || []);
        await loadStats();
        if (onImportComplete) onImportComplete();
      }
    } catch (error) {
      console.error('Category enrichment failed:', error);
    } finally {
      setEnrichingCategory(false);
    }
  }

  async function startEnrichment() {
    const selectedCount = Object.values(services).filter(Boolean).length;
    if (selectedCount === 0) {
      alert('Please select at least one service');
      return;
    }

    const serviceNames = Object.entries(services)
      .filter(([, enabled]) => enabled)
      .map(([key]) => {
        const names: Record<string, string> = {
          musicbrainz: 'MusicBrainz',
          lastfm: 'Last.fm',
          spotifyEnhanced: 'Spotify Enhanced',
          appleMusicEnhanced: 'Apple Music Enhanced',
          allmusic: 'AllMusic',
          wikipedia: 'Wikipedia',
          coverArtArchive: 'Cover Art Archive',
          acousticbrainz: 'AcousticBrainz',
          discogsMetadata: 'Discogs Metadata',
          discogsTracklist: 'Discogs Tracklist',
          genius: 'Genius',
        };
        return names[key] || key;
      });

    const message = folderFilter 
      ? `Enrich albums in "${folderFilter}" with: ${serviceNames.join(', ')}?`
      : `Enrich up to ${batchSize} albums with: ${serviceNames.join(', ')}?`;

    if (!confirm(`${message}\n\nThis may take several minutes. Continue?`)) {
      return;
    }

    setEnriching(true);
    setStatus('Starting enrichment...');
    setEnrichmentResults([]);
    setProcessedCount(0);

    try {
      let cursor = 0;
      const limit = batchSize === 'all' ? 10000 : parseInt(batchSize);
      const allResults: AlbumResult[] = [];
      let totalProcessed = 0;

      while (totalProcessed < limit) {
        setStatus(`Processing batch from ID ${cursor}...`);

        const res = await fetch('/api/enrich-sources/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cursor,
            limit: Math.min(limit - totalProcessed, 10),
            folder: folderFilter || undefined,
            services
          })
        });

        const result = await res.json();

        if (!result.success) {
          setStatus(`❌ Error: ${result.error}`);
          break;
        }

        if (result.results && result.results.length > 0) {
          allResults.push(...result.results);
          setEnrichmentResults([...allResults]);
          totalProcessed += result.processed;
          setProcessedCount(totalProcessed);
        }

        if (!result.hasMore || totalProcessed >= limit) {
          setStatus(`✅ Complete! Enriched ${totalProcessed} albums.`);
          await loadStats();
          if (onImportComplete) onImportComplete();
          break;
        }

        cursor = result.nextCursor;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEnriching(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30000,
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          width: '1200px',
          maxWidth: '95vw',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header - matches Discogs import style */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f59e0b',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              ⚡ Multi-Source Enrichment (9 Services)
            </h2>
            <button
              onClick={onClose}
              disabled={enriching}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: enriching ? 'not-allowed' : 'pointer',
                padding: 0,
                opacity: enriching ? 0.5 : 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚙️</div>
                <p style={{ color: '#666', margin: 0 }}>Loading statistics...</p>
              </div>
            ) : stats ? (
              <>
                {/* Collection Overview */}
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>
                    Collection Overview
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px'
                  }}>
                    <StatBox 
                      label="Total Albums" 
                      value={stats.total} 
                      color="#3b82f6" 
                      onClick={() => {}} 
                      disabled 
                    />
                    <StatBox 
                      label="Fully Enriched" 
                      value={stats.fullyEnriched} 
                      color="#10b981"
                      onClick={() => showCategory('fully-enriched', 'Fully Enriched Albums')} 
                    />
                    <StatBox 
                      label="Needs Enrichment" 
                      value={stats.needsEnrichment} 
                      color="#f59e0b"
                      onClick={() => showCategory('needs-enrichment', 'Albums Needing Enrichment')} 
                    />
                  </div>
                </div>

                {/* Service Selection */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>
                    Select Services
                  </h3>
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px'
                  }}>
                    <ServiceCheckbox 
                      label="🎼 MusicBrainz" 
                      checked={services.musicbrainz} 
                      onChange={(c) => setServices(p => ({ ...p, musicbrainz: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="🎵 Last.fm" 
                      checked={services.lastfm} 
                      onChange={(c) => setServices(p => ({ ...p, lastfm: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="🎧 Spotify Enhanced" 
                      checked={services.spotifyEnhanced} 
                      onChange={(c) => setServices(p => ({ ...p, spotifyEnhanced: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="🍎 Apple Music Enhanced" 
                      checked={services.appleMusicEnhanced} 
                      onChange={(c) => setServices(p => ({ ...p, appleMusicEnhanced: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="📚 AllMusic" 
                      checked={services.allmusic} 
                      onChange={(c) => setServices(p => ({ ...p, allmusic: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="📖 Wikipedia" 
                      checked={services.wikipedia} 
                      onChange={(c) => setServices(p => ({ ...p, wikipedia: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="🖼️ Cover Art Archive" 
                      checked={services.coverArtArchive} 
                      onChange={(c) => setServices(p => ({ ...p, coverArtArchive: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="🎹 AcousticBrainz" 
                      checked={services.acousticbrainz} 
                      onChange={(c) => setServices(p => ({ ...p, acousticbrainz: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="💿 Discogs Metadata" 
                      checked={services.discogsMetadata} 
                      onChange={(c) => setServices(p => ({ ...p, discogsMetadata: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="💿 Discogs Tracklist" 
                      checked={services.discogsTracklist} 
                      onChange={(c) => setServices(p => ({ ...p, discogsTracklist: c }))} 
                      disabled={enriching} 
                    />
                    <ServiceCheckbox 
                      label="📝 Genius" 
                      checked={services.genius} 
                      onChange={(c) => setServices(p => ({ ...p, genius: c }))} 
                      disabled={enriching} 
                    />
                  </div>
                </div>

                {/* Filters */}
                <div style={{
                  marginBottom: '16px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '16px',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#111827',
                        minWidth: '50px'
                      }}>
                        Folder:
                      </label>
                      <select
                        value={folderFilter}
                        onChange={(e) => setFolderFilter(e.target.value)}
                        disabled={enriching}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          color: '#111827',
                          cursor: enriching ? 'not-allowed' : 'pointer',
                          minWidth: '180px',
                        }}
                      >
                        <option value="">All Folders</option>
                        {folders.map(folder => (
                          <option key={folder} value={folder}>{folder}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#111827',
                        minWidth: '80px'
                      }}>
                        Batch Size:
                      </label>
                      <select
                        value={batchSize}
                        onChange={(e) => setBatchSize(e.target.value)}
                        disabled={enriching}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px',
                          backgroundColor: 'white',
                          color: '#111827',
                          cursor: enriching ? 'not-allowed' : 'pointer',
                          minWidth: '100px',
                        }}
                      >
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                        <option value="500">500</option>
                        <option value="all">ALL</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status Message */}
                {status && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    backgroundColor: status.includes('Error') || status.includes('❌')
                      ? '#fee2e2'
                      : status.includes('Complete') || status.includes('✅')
                      ? '#dcfce7'
                      : '#dbeafe',
                    border: `1px solid ${
                      status.includes('Error') || status.includes('❌')
                        ? '#dc2626'
                        : status.includes('Complete') || status.includes('✅')
                        ? '#16a34a'
                        : '#3b82f6'
                    }`,
                    color: status.includes('Error') || status.includes('❌')
                      ? '#991b1b'
                      : status.includes('Complete') || status.includes('✅')
                      ? '#15803d'
                      : '#1e40af',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}>
                    {status}
                    {processedCount > 0 && (
                      <div style={{ marginTop: '4px', fontSize: '13px' }}>
                        Processed: {processedCount} albums
                      </div>
                    )}
                  </div>
                )}

                {/* Results Display */}
                {enrichmentResults.length > 0 && (
                  <div style={{
                    maxHeight: '300px',
                    overflow: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#111827',
                      position: 'sticky',
                      top: 0,
                    }}>
                      Recent Results ({enrichmentResults.length})
                    </div>
                    <div style={{ padding: '8px' }}>
                      {enrichmentResults.slice(-10).reverse().map((result, idx) => (
                        <div key={idx} style={{
                          fontSize: '13px',
                          padding: '8px 12px',
                          borderBottom: idx < 9 ? '1px solid #f3f4f6' : 'none',
                          color: '#111827',
                        }}>
                          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                            {result.artist} - {result.title}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {result.musicbrainz && <ResultIcon result={result.musicbrainz} label="MB" />}
                            {result.lastfm && <ResultIcon result={result.lastfm} label="LFM" />}
                            {result.spotifyEnhanced && <ResultIcon result={result.spotifyEnhanced} label="SP" />}
                            {result.appleMusicEnhanced && <ResultIcon result={result.appleMusicEnhanced} label="AM" />}
                            {result.allmusic && <ResultIcon result={result.allmusic} label="AMG" />}
                            {result.wikipedia && <ResultIcon result={result.wikipedia} label="WP" />}
                            {result.coverArtArchive && <ResultIcon result={result.coverArtArchive} label="CAA" />}
                            {result.acousticbrainz && <ResultIcon result={result.acousticbrainz} label="AB" />}
                            {result.discogsMetadata && <ResultIcon result={result.discogsMetadata} label="DM" />}
                            {result.discogsTracklist && <ResultIcon result={result.discogsTracklist} label="DT" />}
                            {result.genius && <ResultIcon result={result.genius} label="GE" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: '#dc2626', margin: '0 0 12px 0', fontSize: '14px' }}>Failed to load statistics</p>
                <button onClick={loadStats} style={{
                  padding: '8px 16px',
                  backgroundColor: '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: 'white',
                }}>Retry</button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}>
            <button 
              onClick={loadStats} 
              disabled={enriching || loading} 
              style={{
                padding: '8px 16px',
                backgroundColor: enriching || loading ? '#d1d5db' : '#3b82f6',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: enriching || loading ? 'not-allowed' : 'pointer',
                color: 'white',
              }}
            >
              🔄 Refresh Stats
            </button>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={onClose} 
                disabled={enriching} 
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: enriching ? 'not-allowed' : 'pointer',
                  color: '#374151',
                }}
              >
                Close
              </button>
              <button 
                onClick={startEnrichment} 
                disabled={enriching || !stats || Object.values(services).every(v => !v)} 
                style={{
                  padding: '8px 16px',
                  backgroundColor: enriching || !stats || Object.values(services).every(v => !v) ? '#d1d5db' : '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: enriching || !stats || Object.values(services).every(v => !v) ? 'not-allowed' : 'pointer',
                  color: 'white',
                }}
              >
                {enriching ? '⚡ Enriching...' : '⚡ Start Enrichment'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '1000px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              backgroundColor: '#f59e0b',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{categoryTitle}</h3>
              <button 
                onClick={() => setShowCategoryModal(false)} 
                disabled={enrichingCategory} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: enrichingCategory ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {categoryAlbums.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <button 
                    onClick={enrichCategory} 
                    disabled={enrichingCategory} 
                    style={{
                      padding: '10px 20px',
                      backgroundColor: enrichingCategory ? '#d1d5db' : '#f59e0b',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: enrichingCategory ? 'not-allowed' : 'pointer',
                      color: 'white',
                    }}
                  >
                    {enrichingCategory ? '⚡ Enriching...' : `⚡ Enrich ${categoryAlbums.length} Albums`}
                  </button>
                </div>
              )}

              {categoryResults.length > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #16a34a',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#15803d',
                  fontWeight: '500',
                }}>
                  ✅ Enriched {categoryResults.length} albums
                </div>
              )}

              {loadingCategory ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: '#666', margin: 0 }}>Loading albums...</p>
                </div>
              ) : categoryAlbums.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: '#666', margin: 0 }}>No albums found</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px',
                }}>
                  {categoryAlbums.map(album => (
                    <div key={album.id} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      padding: '8px',
                      backgroundColor: 'white',
                    }}>
                      <Image
                        src={album.image_url || '/images/placeholder.png'}
                        alt={album.title}
                        width={120}
                        height={120}
                        style={{
                          width: '100%',
                          height: 'auto',
                          aspectRatio: '1',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '6px',
                        }}
                        unoptimized
                      />
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '2px', 
                        fontSize: '11px',
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {album.title}
                      </div>
                      <div style={{ 
                        color: '#6b7280', 
                        fontSize: '11px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {album.artist}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button 
                onClick={() => setShowCategoryModal(false)} 
                disabled={enrichingCategory} 
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: enrichingCategory ? 'not-allowed' : 'pointer',
                  color: '#374151',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, color, onClick, disabled = false }: { 
  label: string; 
  value: number; 
  color: string; 
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div 
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '16px',
        backgroundColor: 'white',
        border: `2px solid ${color}`,
        borderRadius: '6px',
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${color}33`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: '700', color, marginBottom: '4px' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      {!disabled && (
        <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
          Click to view
        </div>
      )}
    </div>
  );
}

function ServiceCheckbox({ label, checked, onChange, disabled }: { 
  label: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void; 
  disabled: boolean;
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      backgroundColor: checked ? '#fff7ed' : 'white',
      border: `2px solid ${checked ? '#f59e0b' : '#e5e7eb'}`,
      borderRadius: '6px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      fontSize: '14px',
      fontWeight: '500',
      color: '#111827',
      transition: 'all 0.2s',
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: '16px', height: '16px', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <span>{label}</span>
    </label>
  );
}

function ResultIcon({ result, label }: { result: { success: boolean; skipped?: boolean }; label: string }) {
  const icon = result.skipped ? '⏭️' : result.success ? '✅' : '❌';
  const color = result.skipped ? '#9ca3af' : result.success ? '#10b981' : '#ef4444';
  return (
    <span 
      style={{ 
        fontSize: '11px', 
        color,
        padding: '2px 6px',
        backgroundColor: result.skipped ? '#f3f4f6' : result.success ? '#dcfce7' : '#fee2e2',
        borderRadius: '3px',
        fontWeight: '500',
      }} 
      title={label}
    >
      {icon} {label}
    </span>
  );
}