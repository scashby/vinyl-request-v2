// src/app/admin/enrich-collection/page.tsx - WITH DISCOGS TRACKLIST SUPPORT
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  discogsTracklist?: {
    success: boolean;
    data?: { totalTracks?: number; tracksWithArtists?: number };
    error?: string;
    skipped?: boolean;
    details?: unknown;
  };
  spotify?: {
    success: boolean;
    data?: { spotify_id?: string; genres?: string[] };
    error?: string;
    skipped?: boolean;
    details?: unknown;
  };
  appleMusic?: {
    success: boolean;
    data?: { apple_music_id?: string; genres?: string[] };
    error?: string;
    skipped?: boolean;
    details?: unknown;
  };
  genius?: {
    success: boolean;
    enrichedCount?: number;
    failedCount?: number;
    enrichedTracks?: Array<{ position: string; title: string; lyrics_url: string }>;
    failedTracks?: Array<{ position: string; title: string; error: string }>;
    error?: string;
    skipped?: boolean;
    details?: unknown;
  };
  appleLyrics?: {
    success: boolean;
    lyricsFound?: number;
    lyricsMissing?: number;
    missingTracks?: string[];
    error?: string;
    skipped?: boolean;
    details?: unknown;
  };
};

export default function MultiSourceEnrichment() {
  const [stats, setStats] = useState({
    total: 0,
    needsEnrichment: 0,
    fullyEnriched: 0,
    bothServices: 0,
    unenriched: 0,
    spotifyOnly: 0,
    appleOnly: 0,
    geniusLyrics: 0,
    appleLyrics: 0,
    needsAppleLyrics: 0,
    anyLyrics: 0
  });
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [batchSize, setBatchSize] = useState('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedServices, setSelectedServices] = useState({
    discogsTracklist: true,
    spotify: true,
    appleMusic: true,
    genius: true,
    appleLyrics: true
  });
  const [enrichmentResults, setEnrichmentResults] = useState<AlbumResult[]>([]);
  const [expandedAlbum, setExpandedAlbum] = useState<number | null>(null);
  
  const albumsToEnrich = useMemo(() => {
    const servicesSelected = {
      discogsTracklist: selectedServices.discogsTracklist,
      spotify: selectedServices.spotify,
      appleMusic: selectedServices.appleMusic,
      genius: selectedServices.genius,
      appleLyrics: selectedServices.appleLyrics
    };
    
    const count = Object.values(servicesSelected).filter(Boolean).length;
    if (count === 0) return 0;
    
    if (servicesSelected.appleLyrics && !servicesSelected.spotify && !servicesSelected.appleMusic && !servicesSelected.genius && !servicesSelected.discogsTracklist) {
      return stats.needsAppleLyrics;
    }
    
    if ((servicesSelected.spotify || servicesSelected.appleMusic) && !servicesSelected.genius && !servicesSelected.appleLyrics && !servicesSelected.discogsTracklist) {
      return stats.unenriched + stats.spotifyOnly + stats.appleOnly;
    }
    
    return stats.needsEnrichment;
  }, [selectedServices, stats.needsAppleLyrics, stats.needsEnrichment, stats.unenriched, stats.spotifyOnly, stats.appleOnly]);

  useEffect(() => {
    loadStatsAndFolders();
  }, []);

  async function loadStatsAndFolders() {
    try {
      const res = await fetch('/api/enrich-sources/stats');
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

  async function enrichAll() {
    const selectedCount = Object.values(selectedServices).filter(Boolean).length;
    if (selectedCount === 0) {
      alert('Please select at least one service to enrich');
      return;
    }

    const serviceNames = [];
    if (selectedServices.discogsTracklist) serviceNames.push('Discogs Tracklist');
    if (selectedServices.spotify) serviceNames.push('Spotify');
    if (selectedServices.appleMusic) serviceNames.push('Apple Music');
    if (selectedServices.genius) serviceNames.push('Genius');
    if (selectedServices.appleLyrics) serviceNames.push('Apple Lyrics');

    if (!confirm(`This will enrich up to ${albumsToEnrich} albums with: ${serviceNames.join(', ')}${folderFilter ? `\nFolder: "${folderFilter}"` : ' (all folders)'}\n\nThis may take a while and consume API quota. Continue?`)) {
      return;
    }

    setEnriching(true);
    setEnrichmentResults([]);
    setStatus('Starting enrichment...');
    
    let cursor = 0;
    let totalProcessed = 0;
    const limit = batchSize === 'all' ? 10000 : parseInt(batchSize);
    const allResults: AlbumResult[] = [];

    console.log('========================================');
    console.log('STARTING MULTI-SOURCE ENRICHMENT');
    console.log('========================================');
    console.log('Selected services:', selectedServices);
    console.log('Batch size:', batchSize, '(limit:', limit, ')');
    console.log('Folder filter:', folderFilter || 'none');
    console.log('Albums needing enrichment:', albumsToEnrich);

    try {
      while (true) {
        setStatus(`Processing${folderFilter ? ` folder "${folderFilter}"` : ''} from ID ${cursor}...`);
        
        console.log(`Starting batch from cursor ${cursor}, limit ${limit}`);
        
        const res = await fetch('/api/enrich-sources/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            cursor, 
            limit,
            folder: folderFilter || undefined,
            services: selectedServices
          })
        });

        const result = await res.json();
        
        console.log(`Batch result:`, {
          success: result.success,
          processed: result.processed,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          resultsCount: result.results?.length || 0
        });
        
        if (result.results && result.results.length > 0) {
          result.results.forEach((albumResult: AlbumResult) => {
            console.group(`Album #${albumResult.albumId}: ${albumResult.artist} - ${albumResult.title}`);
            if (albumResult.discogsTracklist) {
              console.log('Discogs Tracklist:', albumResult.discogsTracklist);
              if (albumResult.discogsTracklist.details) {
                console.log('Discogs details:', albumResult.discogsTracklist.details);
              }
            }
            if (albumResult.spotify) {
              console.log('Spotify:', albumResult.spotify);
              if (albumResult.spotify.details) {
                console.log('Spotify details:', albumResult.spotify.details);
              }
            }
            if (albumResult.appleMusic) {
              console.log('Apple Music:', albumResult.appleMusic);
              if (albumResult.appleMusic.details) {
                console.log('Apple Music details:', albumResult.appleMusic.details);
              }
            }
            if (albumResult.genius) {
              console.log('Genius:', albumResult.genius);
              if (albumResult.genius.details) {
                console.log('Genius details:', albumResult.genius.details);
              }
            }
            if (albumResult.appleLyrics) {
              console.log('Apple Lyrics:', albumResult.appleLyrics);
              if (!albumResult.appleLyrics.success) {
                console.error('Apple Lyrics failed:', albumResult.appleLyrics.error);
                if (albumResult.appleLyrics.details) {
                  console.error('Full error details:', albumResult.appleLyrics.details);
                }
              }
            }
            console.groupEnd();
          });
        }
        
        if (!result.success) {
          setStatus(`Error: ${result.error}`);
          console.error('Batch failed:', result.error);
          break;
        }

        totalProcessed += result.processed;
        
        if (result.results && result.results.length > 0) {
          allResults.push(...result.results);
          setEnrichmentResults([...allResults]);
        }

        setStatus(`Processed ${totalProcessed} albums...`);

        if (!result.hasMore) {
          setStatus(`Complete! Processed ${totalProcessed} albums. See detailed results below.`);
          console.log('========================================');
          console.log('ENRICHMENT COMPLETE');
          console.log('Total albums processed:', totalProcessed);
          console.log('========================================');
          await loadStatsAndFolders();
          break;
        }

        cursor = result.nextCursor;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Error: ${errorMessage}`);
      console.error('Fatal error:', error);
    } finally {
      setEnriching(false);
    }
  }

  const getResultIcon = (result?: { success: boolean; error?: string; skipped?: boolean }) => {
    if (!result) return '⚪';
    if (result.skipped) return '⏭️';
    if (result.success) return '✅';
    return '❌';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Multi-Source Metadata Enrichment
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 8 }}>
        Enrich your entire collection with data from Discogs, Spotify, Apple Music, and lyrics databases
      </p>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24, fontStyle: 'italic' }}>
        Open browser DevTools Console (F12) to see detailed enrichment logs for each album
      </p>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Collection Overview
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <div style={{
            background: 'white',
            border: `2px solid #3b82f6`,
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
            opacity: 0.6
          }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#3b82f6', marginBottom: 4 }}>
              {stats.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 600, marginBottom: 4 }}>
              Total Albums
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              All albums in collection
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Start Enrichment
        </h2>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Select Services to Enrich:
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.discogsTracklist}
                onChange={e => setSelectedServices(prev => ({ ...prev, discogsTracklist: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>💿 Discogs Tracklist</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.spotify}
                onChange={e => setSelectedServices(prev => ({ ...prev, spotify: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Spotify</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.appleMusic}
                onChange={e => setSelectedServices(prev => ({ ...prev, appleMusic: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Apple Music</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.genius}
                onChange={e => setSelectedServices(prev => ({ ...prev, genius: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Genius Lyrics</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.appleLyrics}
                onChange={e => setSelectedServices(prev => ({ ...prev, appleLyrics: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>Apple Lyrics</span>
            </label>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <button
            onClick={enrichAll}
            disabled={enriching || albumsToEnrich === 0 || Object.values(selectedServices).every(v => !v)}
            style={{
              padding: '12px 24px',
              background: (enriching || albumsToEnrich === 0 || Object.values(selectedServices).every(v => !v)) ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: (enriching || albumsToEnrich === 0 || Object.values(selectedServices).every(v => !v)) ? 'not-allowed' : 'pointer',
              boxShadow: enriching ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}
          >
            {enriching ? 'Enriching...' : `Enrich ${albumsToEnrich} Albums`}
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
              <option value="" style={{ color: '#1f2937', backgroundColor: '#ffffff' }}>All Folders</option>
              <option value="">All Folders</option>
              {folders.map(folder => (
                <option key={folder} value={folder} style={{ color: '#1f2937', backgroundColor: '#ffffff' }}>{folder}</option>
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
            Refresh Stats
          </button>
        </div>

        {status && (
          <div style={{
            padding: 12,
            background: status.includes('Error') ? '#fee2e2' : 
                       status.includes('Complete') ? '#dcfce7' : '#dbeafe',
            border: `1px solid ${status.includes('Error') ? '#dc2626' : 
                                 status.includes('Complete') ? '#16a34a' : '#3b82f6'}`,
            borderRadius: 6,
            fontSize: 14,
            color: status.includes('Error') ? '#991b1b' : 
                   status.includes('Complete') ? '#15803d' : '#1e40af',
            fontWeight: 500
          }}>
            {status}
          </div>
        )}
      </div>

      {enrichmentResults.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
            Detailed Results ({enrichmentResults.length} albums)
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {enrichmentResults.map((result) => (
              <div key={result.albumId} style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden'
              }}>
                <div
                  onClick={() => setExpandedAlbum(expandedAlbum === result.albumId ? null : result.albumId)}
                  style={{
                    padding: 16,
                    background: '#f9fafb',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
                      #{result.albumId}: {result.artist} - {result.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12 }}>
                      <span>{getResultIcon(result.discogsTracklist)} Discogs</span>
                      <span>{getResultIcon(result.spotify)} Spotify</span>
                      <span>{getResultIcon(result.appleMusic)} Apple Music</span>
                      <span>{getResultIcon(result.genius)} Genius</span>
                      <span>{getResultIcon(result.appleLyrics)} Apple Lyrics</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: '#6b7280' }}>
                    {expandedAlbum === result.albumId ? '▼' : '▶'}
                  </div>
                </div>

                {expandedAlbum === result.albumId && (
                  <div style={{ padding: 16, background: 'white', fontSize: 13 }}>
                    {result.discogsTracklist && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#fef3c7', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#d97706', marginBottom: 6 }}>
                          {getResultIcon(result.discogsTracklist)} Discogs Tracklist
                        </div>
                        {result.discogsTracklist.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>Already has tracklist with artists</div>
                        ) : result.discogsTracklist.success ? (
                          <div style={{ color: '#92400e', fontSize: 12 }}>
                            {result.discogsTracklist.data?.tracksWithArtists || 0}/{result.discogsTracklist.data?.totalTracks || 0} tracks with per-track artist info
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>{result.discogsTracklist.error}</div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                      <Link
                        href={`/admin/edit-entry/${result.albumId}`}
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: 'white',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        Edit Album
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}