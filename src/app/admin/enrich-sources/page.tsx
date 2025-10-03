// src/app/admin/enrich-sources/page.tsx - IMPROVED WITH CLICKABLE CARDS
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
};

export default function MultiSourceEnrichment() {
  const [stats, setStats] = useState({
    total: 0,
    needsEnrichment: 0,
    unenriched: 0,
    spotifyOnly: 0,
    appleOnly: 0,
    fullyEnriched: 0,
    partialLyrics: 0
  });
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastEnriched, setLastEnriched] = useState(null);
  const [batchSize, setBatchSize] = useState('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [folders, setFolders] = useState([]);
  const [totalEnriched, setTotalEnriched] = useState(0);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalAlbums, setModalAlbums] = useState<Album[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    loadStatsAndFolders();
  }, []);

  async function loadStatsAndFolders() {
    try {
      const res = await fetch('/api/enrich-multi-stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        if (data.folders) {
          setFolders(data.folders);
        }
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function showAlbumsForCategory(category: string, title: string) {
    setShowModal(true);
    setModalTitle(title);
    setModalAlbums([]);
    setLoadingModal(true);

    try {
      const res = await fetch(`/api/enrich-multi-albums?category=${category}`);
      const data = await res.json();
      if (data.success) {
        setModalAlbums(data.albums || []);
      }
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoadingModal(false);
    }
  }

  async function enrichAll() {
    if (!confirm(`This will enrich ${stats.needsEnrichment} albums${folderFilter ? ` in folder "${folderFilter}"` : ' (all folders)'}. This may take a while and consume API quota. Continue?`)) {
      return;
    }

    setEnriching(true);
    setProgress({ current: 0, total: 0 });
    setTotalEnriched(0);
    setStatus('Starting enrichment...');
    
    let cursor = 0;
    let totalProcessed = 0;
    let enrichedCount = 0;
    const limit = batchSize === 'all' ? 10000 : parseInt(batchSize);

    try {
      while (true) {
        setStatus(`Processing${folderFilter ? ` folder "${folderFilter}"` : ''} from ID ${cursor}...`);
        
        const res = await fetch('/api/enrich-multi-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cursor, 
            limit,
            folder: folderFilter || undefined
          })
        });

        const result = await res.json();
        
        if (!result.success) {
          setStatus(`❌ Error: ${result.error}`);
          break;
        }

        totalProcessed += result.processed;
        enrichedCount += result.enriched;
        
        setProgress({ current: totalProcessed, total: totalProcessed });
        setTotalEnriched(enrichedCount);
        
        if (result.lastAlbum) {
          setLastEnriched(result.lastAlbum);
        }

        setStatus(`Processed ${totalProcessed} albums, enriched ${enrichedCount}...`);

        if (!result.hasMore) {
          setStatus(`✅ Complete! Processed ${totalProcessed} albums, enriched ${enrichedCount}`);
          await loadStatsAndFolders();
          break;
        }

        cursor = result.nextCursor;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
        🎵 Multi-Source Metadata Enrichment
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Enrich your entire collection with data from Spotify, Apple Music, and lyrics databases
      </p>

      {/* Overview Stats */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          📊 Collection Overview
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="Total Albums" 
            value={stats.total} 
            color="#3b82f6"
            description="All albums in collection"
            onClick={() => {}}
            disabled
          />
          <ClickableStatCard 
            label="✅ Fully Enriched" 
            value={stats.fullyEnriched} 
            color="#16a34a"
            description="Has both Spotify & Apple Music"
            onClick={() => showAlbumsForCategory('fully-enriched', '✅ Fully Enriched Albums')}
          />
          <ClickableStatCard 
            label="⚠️ Needs Enrichment" 
            value={stats.needsEnrichment} 
            color="#f59e0b"
            description="Missing Spotify or Apple Music"
            onClick={() => showAlbumsForCategory('needs-enrichment', '⚠️ Albums Needing Enrichment')}
          />
        </div>
      </div>

      {/* Breakdown of What Needs Enrichment */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          🔍 Enrichment Breakdown
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="❌ No Data" 
            value={stats.unenriched} 
            color="#dc2626"
            description="Missing both services"
            onClick={() => showAlbumsForCategory('no-data', '❌ Albums with No Data')}
          />
          <ClickableStatCard 
            label="🎵 Missing Spotify" 
            value={stats.appleOnly} 
            color="#1DB954"
            description="Has Apple Music only"
            onClick={() => showAlbumsForCategory('missing-spotify', '🎵 Albums Missing Spotify')}
          />
          <ClickableStatCard 
            label="🍎 Missing Apple Music" 
            value={stats.spotifyOnly} 
            color="#FA57C1"
            description="Has Spotify only"
            onClick={() => showAlbumsForCategory('missing-apple', '🍎 Albums Missing Apple Music')}
          />
          <ClickableStatCard 
            label="📝 With Lyrics" 
            value={stats.partialLyrics} 
            color="#7c3aed"
            description="Has some lyrics data"
            onClick={() => showAlbumsForCategory('with-lyrics', '📝 Albums with Lyrics')}
          />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          ⚡ Start Enrichment
        </h2>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={enrichAll}
            disabled={enriching || stats.needsEnrichment === 0}
            style={{
              padding: '12px 24px',
              background: enriching || stats.needsEnrichment === 0 ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: enriching || stats.needsEnrichment === 0 ? 'not-allowed' : 'pointer',
              boxShadow: enriching ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}
          >
            {enriching ? '⚡ Enriching...' : `⚡ Enrich ${stats.needsEnrichment} Albums`}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Folder:
            </label>
            <select
              value={folderFilter}
              onChange={e => setFolderFilter(e.target.value)}
              disabled={enriching}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937',
                cursor: enriching ? 'not-allowed' : 'pointer',
                minWidth: 150
              }}
            >
              <option value="">All Folders</option>
              {folders.map(folder => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Batch Size:
            </label>
            <select
              value={batchSize}
              onChange={e => setBatchSize(e.target.value)}
              disabled={enriching}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'white',
                color: '#1f2937',
                cursor: enriching ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="all">ALL (No Limit)</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </div>

          <button
            onClick={loadStatsAndFolders}
            disabled={enriching}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: enriching ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 Refresh Stats
          </button>
        </div>

        {/* Progress Bar */}
        {enriching && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              fontSize: 14,
              color: '#6b7280'
            }}>
              <span>Processed: {progress.current} albums</span>
              <span>{totalEnriched} enriched</span>
            </div>
            <div style={{
              width: '100%',
              height: 24,
              background: '#e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                opacity: 0.8
              }} />
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div style={{
            padding: 12,
            background: status.includes('❌') ? '#fee2e2' : 
                       status.includes('✅') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${status.includes('❌') ? '#dc2626' : 
                                 status.includes('✅') ? '#16a34a' : '#3b82f6'}`,
            borderRadius: 6,
            fontSize: 14,
            color: status.includes('❌') ? '#991b1b' : 
                   status.includes('✅') ? '#15803d' : '#1e40af',
            fontWeight: 500
          }}>
            {status}
          </div>
        )}

        {/* Last Enriched */}
        {lastEnriched && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Last enriched:
            </div>
            <div style={{ fontWeight: 600, color: '#1f2937' }}>
              {lastEnriched.artist} - {lastEnriched.title}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {lastEnriched.spotify && '✓ Spotify'} 
              {lastEnriched.appleMusic && ' • ✓ Apple Music'}
              {lastEnriched.lyrics && ' • ✓ Lyrics'}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 8,
        padding: 16,
        fontSize: 14,
        color: '#0c4a6e'
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          💡 Click any stat card above to view albums in that category
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: 24
        }}
        onClick={() => setShowModal(false)}
        >
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 32,
            maxWidth: 1200,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
          onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24
            }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: '#1f2937', margin: 0 }}>
                {modalTitle}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            {loadingModal ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                Loading albums...
              </div>
            ) : modalAlbums.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                No albums found in this category
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 16
              }}>
                {modalAlbums.map(album => (
                  <div key={album.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    background: '#f9fafb'
                  }}>
                    <Image
                      src={album.image_url || '/images/placeholder.png'}
                      alt={album.title}
                      width={160}
                      height={160}
                      style={{
                        width: '100%',
                        height: 'auto',
                        aspectRatio: '1',
                        objectFit: 'cover',
                        borderRadius: 6,
                        marginBottom: 8
                      }}
                      unoptimized
                    />
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#1f2937',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 4
                    }}>
                      {album.title}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: 8
                    }}>
                      {album.artist}
                    </div>
                    <div style={{
                      display: 'flex',
                      gap: 4,
                      marginBottom: 8,
                      fontSize: 10
                    }}>
                      {album.spotify_id && (
                        <span style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          Spotify
                        </span>
                      )}
                      {album.apple_music_id && (
                        <span style={{
                          background: '#fce7f3',
                          color: '#be185d',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontWeight: 600
                        }}>
                          Apple
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/admin/edit-entry/${album.id}`}
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '6px 12px',
                        background: '#3b82f6',
                        color: 'white',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClickableStatCard({ label, value, color, description, onClick, disabled = false }) {
  return (
    <div 
      onClick={disabled ? undefined : onClick}
      style={{
        background: 'white',
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: 16,
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.6 : 1
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${color}40`;
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 'bold', color, marginBottom: 4 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        {description}
      </div>
      {!disabled && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
          Click to view →
        </div>
      )}
    </div>
  );
}