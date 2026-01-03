// src/app/edit-collection/components/ImportEnrichModal.tsx - DATA-FOCUSED REDESIGN
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  DataCategory, 
  DATA_CATEGORY_LABELS, 
  DATA_CATEGORY_DESCRIPTIONS,
  DATA_CATEGORY_ICONS,
  dataCategoriesToServices 
} from '../../../lib/enrichment-data-mapping';

interface ImportEnrichModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type EnrichmentStats = {
  total: number;
  needsEnrichment: number;
  fullyEnriched: number;
  
  // Artwork
  missingArtwork: number;
  missingBackCover: number;
  missingSpineCover: number;
  missingInnerSleeves: number;
  missingLabelImages: number;
  
  // Credits
  missingCredits: number;
  missingMusicians: number;
  missingProducers: number;
  missingEngineers: number;
  missingSongwriters: number;
  
  // Tracklists
  missingTracklists: number;
  
  // Audio Analysis
  missingAudioAnalysis: number;
  missingTempo: number;
  missingKey: number;
  missingMoodData: number;
  
  // Genres
  missingGenres: number;
  
  // Streaming Links
  missingStreamingLinks: number;
  missingSpotify: number;
  missingAppleMusic: number;
  missingLastFm: number;
  
  // Reviews
  missingReviews: number;
  missingRatings: number;
  
  // Chart Data
  missingChartData: number;
  
  // Release Metadata
  missingReleaseMetadata: number;
  missingDiscogsIds: number;
  missingLabels: number;
  missingCatalogNumber: number;
  missingBarcode: number;
  missingCountry: number;
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
  [key: string]: unknown;
};

export default function ImportEnrichModal({ isOpen, onClose, onImportComplete }: ImportEnrichModalProps) {
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [batchSize, setBatchSize] = useState('100');
  
  // Data category selections (what data to enrich)
  const [selectedCategories, setSelectedCategories] = useState<Set<DataCategory>>(new Set([
    'artwork',
    'credits',
    'tracklists',
    'audio_analysis',
    'genres',
    'streaming_links',
  ]));
  
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

    if (selectedCategories.size === 0) {
      alert('Please select at least one data category');
      return;
    }

    if (!confirm(`Enrich ${categoryAlbums.length} albums with selected data?\n\nThis may take several minutes.`)) {
      return;
    }

    setEnrichingCategory(true);
    setCategoryResults([]);

    try {
      const albumIds = categoryAlbums.map(a => a.id);
      const services = dataCategoriesToServices(Array.from(selectedCategories));
      
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
    if (selectedCategories.size === 0) {
      alert('Please select at least one data category');
      return;
    }

    const categoryNames = Array.from(selectedCategories).map(c => DATA_CATEGORY_LABELS[c]);

    const message = folderFilter 
      ? `Enrich albums in "${folderFilter}" with: ${categoryNames.join(', ')}?`
      : `Enrich up to ${batchSize} albums with: ${categoryNames.join(', ')}?`;

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

      // Convert data categories to service selections
      const services = dataCategoriesToServices(Array.from(selectedCategories));

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

  function toggleCategory(category: DataCategory) {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  }

  if (!isOpen) return null;

  const dataCategories: { 
    category: DataCategory; 
    count: number; 
    subcounts?: { label: string; count: number }[] 
  }[] = stats ? [
    { 
      category: 'artwork', 
      count: stats.missingArtwork,
      subcounts: [
        { label: 'Back covers', count: stats.missingBackCover },
        { label: 'Spine images', count: stats.missingSpineCover },
        { label: 'Inner sleeves', count: stats.missingInnerSleeves },
        { label: 'Label images', count: stats.missingLabelImages },
      ]
    },
    { 
      category: 'credits', 
      count: stats.missingCredits,
      subcounts: [
        { label: 'Musicians', count: stats.missingMusicians },
        { label: 'Producers', count: stats.missingProducers },
        { label: 'Engineers', count: stats.missingEngineers },
        { label: 'Songwriters', count: stats.missingSongwriters },
      ]
    },
    { category: 'tracklists', count: stats.missingTracklists },
    { 
      category: 'audio_analysis', 
      count: stats.missingAudioAnalysis,
      subcounts: [
        { label: 'Tempo (BPM)', count: stats.missingTempo },
        { label: 'Musical key', count: stats.missingKey },
        { label: 'Mood data', count: stats.missingMoodData },
      ]
    },
    { category: 'genres', count: stats.missingGenres },
    { 
      category: 'streaming_links', 
      count: stats.missingStreamingLinks,
      subcounts: [
        { label: 'Spotify', count: stats.missingSpotify },
        { label: 'Apple Music', count: stats.missingAppleMusic },
        { label: 'Last.fm', count: stats.missingLastFm },
      ]
    },
    { 
      category: 'reviews', 
      count: stats.missingReviews,
      subcounts: [
        { label: 'Ratings', count: stats.missingRatings },
      ]
    },
    { category: 'chart_data', count: stats.missingChartData },
    { 
      category: 'release_metadata', 
      count: stats.missingReleaseMetadata,
      subcounts: [
        { label: 'Discogs IDs', count: stats.missingDiscogsIds },
        { label: 'Labels', count: stats.missingLabels },
        { label: 'Catalog numbers', count: stats.missingCatalogNumber },
        { label: 'Barcodes', count: stats.missingBarcode },
        { label: 'Countries', count: stats.missingCountry },
      ]
    },
  ] : [];

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
              ⚡ Collection Data Enrichment
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

                {/* Data Categories Selection */}
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                    Select Data to Enrich
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', margin: '0 0 16px 0' }}>
                    Choose which types of data you want to fetch for your albums. Multiple sources may be used for each category.
                  </p>
                  
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '12px'
                  }}>
                    {dataCategories.map(({ category, count, subcounts }) => (
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
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Enriched with selected data sources
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
                disabled={enriching || !stats || selectedCategories.size === 0} 
                style={{
                  padding: '8px 16px',
                  backgroundColor: enriching || !stats || selectedCategories.size === 0 ? '#d1d5db' : '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: enriching || !stats || selectedCategories.size === 0 ? 'not-allowed' : 'pointer',
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
                    disabled={enrichingCategory || selectedCategories.size === 0} 
                    style={{
                      padding: '10px 20px',
                      backgroundColor: enrichingCategory || selectedCategories.size === 0 ? '#d1d5db' : '#f59e0b',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: enrichingCategory || selectedCategories.size === 0 ? 'not-allowed' : 'pointer',
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

function DataCategoryCard({ 
  category, 
  count, 
  subcounts,
  selected, 
  onToggle, 
  disabled 
}: { 
  category: DataCategory;
  count: number;
  subcounts?: { label: string; count: number }[];
  selected: boolean; 
  onToggle: () => void; 
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{
      border: `2px solid ${selected ? '#f59e0b' : '#e5e7eb'}`,
      borderRadius: '6px',
      padding: '12px',
      backgroundColor: selected ? '#fff7ed' : 'white',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      transition: 'all 0.2s',
    }}>
      <div 
        onClick={disabled ? undefined : onToggle}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
          style={{ 
            marginTop: '2px',
            width: '18px', 
            height: '18px', 
            cursor: disabled ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '16px' }}>{DATA_CATEGORY_ICONS[category]}</span>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>
              {DATA_CATEGORY_LABELS[category]}
            </span>
            <span style={{ 
              marginLeft: 'auto',
              fontSize: '16px',
              fontWeight: '700',
              color: count > 0 ? '#f59e0b' : '#10b981',
            }}>
              {count.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4', marginBottom: '6px' }}>
            {DATA_CATEGORY_DESCRIPTIONS[category]}
          </div>
          
          {subcounts && subcounts.length > 0 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 0',
                  fontSize: '11px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                {expanded ? '▼ Hide details' : '▶ Show details'}
              </button>
              
              {expanded && (
                <div style={{ 
                  marginTop: '8px', 
                  paddingTop: '8px', 
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '11px',
                  color: '#6b7280',
                }}>
                  {subcounts.map((sub, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      padding: '2px 0',
                    }}>
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
    </div>
  );
}