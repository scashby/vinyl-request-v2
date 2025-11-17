// src/app/admin/enrich-sources/page.tsx - COMPLETE WITH DISCOGS METADATA ENRICHMENT
"use client";

import { useState, useEffect, useMemo } from 'react';
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

type AlbumResult = {
  albumId: number;
  artist: string;
  title: string;
  discogsMetadata?: {
    success: boolean;
    data?: { foundReleaseId?: string; addedImage?: boolean; addedGenres?: boolean; addedTracklist?: boolean };
    error?: string;
    skipped?: boolean;
  };
  discogsTracklist?: {
    success: boolean;
    data?: { totalTracks?: number; tracksWithArtists?: number };
    error?: string;
    skipped?: boolean;
  };
  spotify?: {
    success: boolean;
    data?: { spotify_id?: string; genres?: string[] };
    error?: string;
    skipped?: boolean;
  };
  appleMusic?: {
    success: boolean;
    data?: { apple_music_id?: string; genres?: string[] };
    error?: string;
    skipped?: boolean;
  };
  genius?: {
    success: boolean;
    enrichedCount?: number;
    failedCount?: number;
    enrichedTracks?: Array<{ position: string; title: string; lyrics_url: string }>;
    failedTracks?: Array<{ position: string; title: string; error: string }>;
    error?: string;
    skipped?: boolean;
  };
  appleLyrics?: {
    success: boolean;
    lyricsFound?: number;
    lyricsMissing?: number;
    missingTracks?: string[];
    error?: string;
    skipped?: boolean;
  };
  match1001?: {
    success: boolean;
    matched?: boolean;
    confidence?: number;
    error?: string;
    skipped?: boolean;
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
    anyLyrics: 0,
    discogsTracklist: 0,
    needsDiscogsTracklist: 0,
    albums1001: 0,
    missingDiscogsId: 0,
    missingImage: 0,
    missingGenres: 0
  });
  const [enriching, setEnriching] = useState(false);
  const [status, setStatus] = useState('');
  const [batchSize, setBatchSize] = useState('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedServices, setSelectedServices] = useState({
    discogsMetadata: true,
    discogsTracklist: true,
    spotify: true,
    appleMusic: true,
    genius: true,
    appleLyrics: true,
    match1001: true
  });
  const [enrichmentResults, setEnrichmentResults] = useState<AlbumResult[]>([]);
  const [expandedAlbum, setExpandedAlbum] = useState<number | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalAlbums, setModalAlbums] = useState<Album[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  
  const albumsToEnrich = useMemo(() => {
    const servicesSelected = {
      discogsMetadata: selectedServices.discogsMetadata,
      discogsTracklist: selectedServices.discogsTracklist,
      spotify: selectedServices.spotify,
      appleMusic: selectedServices.appleMusic,
      genius: selectedServices.genius,
      appleLyrics: selectedServices.appleLyrics,
      match1001: selectedServices.match1001
    };
    
    const count = Object.values(servicesSelected).filter(Boolean).length;
    if (count === 0) return 0;
    
    if (servicesSelected.appleLyrics && !servicesSelected.spotify && !servicesSelected.appleMusic && !servicesSelected.genius && !servicesSelected.discogsTracklist && !servicesSelected.match1001 && !servicesSelected.discogsMetadata) {
      return stats.needsAppleLyrics;
    }
    
    if ((servicesSelected.spotify || servicesSelected.appleMusic) && !servicesSelected.genius && !servicesSelected.appleLyrics && !servicesSelected.discogsTracklist && !servicesSelected.match1001 && !servicesSelected.discogsMetadata) {
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

  async function showAlbumsForCategory(category: string, title: string) {
    setShowModal(true);
    setModalTitle(title);
    setModalAlbums([]);
    setLoadingModal(true);

    try {
      const res = await fetch(`/api/enrich-sources/albums?category=${category}`);
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
    const selectedCount = Object.values(selectedServices).filter(Boolean).length;
    if (selectedCount === 0) {
      alert('Please select at least one service to enrich');
      return;
    }

    const serviceNames = [];
    if (selectedServices.discogsMetadata) serviceNames.push('Discogs Metadata');
    if (selectedServices.discogsTracklist) serviceNames.push('Discogs Tracklist');
    if (selectedServices.spotify) serviceNames.push('Spotify');
    if (selectedServices.appleMusic) serviceNames.push('Apple Music');
    if (selectedServices.genius) serviceNames.push('Genius');
    if (selectedServices.appleLyrics) serviceNames.push('Apple Lyrics');
    if (selectedServices.match1001) serviceNames.push('1001 Albums');

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
            if (albumResult.discogsMetadata) {
              console.log('Discogs Metadata:', albumResult.discogsMetadata);
            }
            if (albumResult.discogsTracklist) {
              console.log('Discogs Tracklist:', albumResult.discogsTracklist);
            }
            if (albumResult.spotify) {
              console.log('Spotify:', albumResult.spotify);
            }
            if (albumResult.appleMusic) {
              console.log('Apple Music:', albumResult.appleMusic);
            }
            if (albumResult.genius) {
              console.log('Genius:', albumResult.genius);
            }
            if (albumResult.appleLyrics) {
              console.log('Apple Lyrics:', albumResult.appleLyrics);
            }
            if (albumResult.match1001) {
              console.log('1001 Match:', albumResult.match1001);
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
        Enrich your entire collection with data from Discogs, Spotify, Apple Music, lyrics databases, and 1001 Albums
      </p>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24, fontStyle: 'italic' }}>
        Open browser DevTools Console (F12) to see detailed enrichment logs for each album
      </p>

      {/* Collection Overview */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Collection Overview
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
            label="Fully Enriched" 
            value={stats.fullyEnriched} 
            color="#16a34a"
            description="Has services + Apple lyrics"
            onClick={() => showAlbumsForCategory('fully-enriched', 'Fully Enriched Albums')}
          />
          <ClickableStatCard 
            label="Needs Enrichment" 
            value={stats.needsEnrichment} 
            color="#f59e0b"
            description="Missing services or lyrics"
            onClick={() => showAlbumsForCategory('needs-enrichment', 'Albums Needing Enrichment')}
          />
          <ClickableStatCard 
            label="📚 1001 Albums" 
            value={stats.albums1001} 
            color="#8b5cf6"
            description="Matched with 1001 Albums list"
            onClick={() => showAlbumsForCategory('1001-albums', '1001 Albums')}
          />
        </div>
      </div>

      {/* Discogs Data Quality */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          💿 Discogs Data Quality
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="⚠️ Missing Release ID" 
            value={stats.missingDiscogsId} 
            color="#dc2626"
            description="Need Discogs search & link"
            onClick={() => showAlbumsForCategory('missing-discogs-id', '⚠️ Albums Missing Discogs Release ID')}
          />
          <ClickableStatCard 
            label="🖼️ Missing Images" 
            value={stats.missingImage} 
            color="#f59e0b"
            description="Have release ID, no image"
            onClick={() => showAlbumsForCategory('missing-image', '🖼️ Albums Missing Cover Art')}
          />
          <ClickableStatCard 
            label="🎵 Missing Genres" 
            value={stats.missingGenres} 
            color="#f59e0b"
            description="No genre/style data"
            onClick={() => showAlbumsForCategory('missing-genres', '🎵 Albums Missing Genre Data')}
          />
        </div>
      </div>

      {/* Streaming Services */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Streaming Services
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minMax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="Both Services" 
            value={stats.bothServices} 
            color="#7c3aed"
            description="Has Spotify + Apple Music"
            onClick={() => showAlbumsForCategory('both-services', 'Albums with Both Services')}
          />
          <ClickableStatCard 
            label="No Services" 
            value={stats.unenriched} 
            color="#dc2626"
            description="Missing both services"
            onClick={() => showAlbumsForCategory('no-data', 'Albums with No Services')}
          />
          <ClickableStatCard 
            label="Missing Spotify" 
            value={stats.appleOnly} 
            color="#1DB954"
            description="Has Apple Music only"
            onClick={() => showAlbumsForCategory('missing-spotify', 'Albums Missing Spotify')}
          />
          <ClickableStatCard 
            label="Missing Apple Music" 
            value={stats.spotifyOnly} 
            color="#FA57C1"
            description="Has Spotify only"
            onClick={() => showAlbumsForCategory('missing-apple', 'Albums Missing Apple Music')}
          />
        </div>
      </div>

      {/* Track Metadata */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Track Metadata
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="Discogs Track Data" 
            value={stats.discogsTracklist} 
            color="#10b981"
            description="Has track artist info"
            onClick={() => showAlbumsForCategory('has-discogs-tracklist', 'Albums with Discogs Track Artists')}
          />
          <ClickableStatCard 
            label="Need Track Artists" 
            value={stats.needsDiscogsTracklist} 
            color="#f59e0b"
            description="Missing track artist data"
            onClick={() => showAlbumsForCategory('needs-discogs-tracklist', 'Albums Needing Track Artist Data')}
          />
        </div>
      </div>

      {/* Lyrics Enrichment */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: '#1f2937' }}>
          Lyrics Enrichment
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          <ClickableStatCard 
            label="Apple Music Lyrics" 
            value={stats.appleLyrics} 
            color="#ec4899"
            description="Full lyrics from Apple Music"
            onClick={() => showAlbumsForCategory('has-apple-lyrics', 'Albums with Apple Music Lyrics')}
          />
          <ClickableStatCard 
            label="Need Apple Lyrics" 
            value={stats.needsAppleLyrics} 
            color="#f59e0b"
            description="Have Apple ID but no lyrics"
            onClick={() => showAlbumsForCategory('needs-apple-lyrics', 'Albums Needing Apple Music Lyrics')}
          />
          <ClickableStatCard 
            label="Genius Links" 
            value={stats.geniusLyrics} 
            color="#6366f1"
            description="Has Genius lyrics URLs"
            onClick={() => showAlbumsForCategory('has-genius-links', 'Albums with Genius Lyrics Links')}
          />
          <ClickableStatCard 
            label="Any Lyrics" 
            value={stats.anyLyrics} 
            color="#8b5cf6"
            description="Has any lyrics data"
            onClick={() => showAlbumsForCategory('with-lyrics', 'Albums with Any Lyrics')}
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
                checked={selectedServices.discogsMetadata}
                onChange={e => setSelectedServices(prev => ({ ...prev, discogsMetadata: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>💿 Discogs Metadata</span>
            </label>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              <input 
                type="checkbox" 
                checked={selectedServices.match1001}
                onChange={e => setSelectedServices(prev => ({ ...prev, match1001: e.target.checked }))}
                disabled={enriching}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600, color: '#1f2937' }}>📚 1001 Albums</span>
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

      {/* Detailed Results */}
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
                      <span>{getResultIcon(result.discogsMetadata)} Metadata</span>
                      <span>{getResultIcon(result.discogsTracklist)} Tracklist</span>
                      <span>{getResultIcon(result.spotify)} Spotify</span>
                      <span>{getResultIcon(result.appleMusic)} Apple</span>
                      <span>{getResultIcon(result.genius)} Genius</span>
                      <span>{getResultIcon(result.appleLyrics)} Lyrics</span>
                      <span>{getResultIcon(result.match1001)} 1001</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: '#6b7280' }}>
                    {expandedAlbum === result.albumId ? '▼' : '▶'}
                  </div>
                </div>

                {expandedAlbum === result.albumId && (
                  <div style={{ padding: 16, background: 'white', fontSize: 13 }}>
                    {result.discogsMetadata && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#fef3c7', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#d97706', marginBottom: 6 }}>
                          {getResultIcon(result.discogsMetadata)} Discogs Metadata
                        </div>
                        {result.discogsMetadata.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>Already has metadata</div>
                        ) : result.discogsMetadata.success ? (
                          <div style={{ color: '#92400e', fontSize: 12 }}>
                            {result.discogsMetadata.data?.foundReleaseId && <div>✓ Found & linked release ID</div>}
                            {result.discogsMetadata.data?.addedImage && <div>✓ Added cover image</div>}
                            {result.discogsMetadata.data?.addedGenres && <div>✓ Added genres/styles</div>}
                            {result.discogsMetadata.data?.addedTracklist && <div>✓ Added tracklist</div>}
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>{result.discogsMetadata.error}</div>
                        )}
                      </div>
                    )}

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

                    {result.spotify && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#f0fdf4', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
                          {getResultIcon(result.spotify)} Spotify
                        </div>
                        {result.spotify.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>Already had Spotify ID</div>
                        ) : result.spotify.success ? (
                          <div style={{ color: '#15803d', fontSize: 12 }}>
                            ID: {result.spotify.data?.spotify_id}
                            {result.spotify.data?.genres && result.spotify.data.genres.length > 0 && (
                              <div>Genres: {result.spotify.data.genres.join(', ')}</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>{result.spotify.error}</div>
                        )}
                      </div>
                    )}

                    {result.appleMusic && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#fef3c7', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#d97706', marginBottom: 6 }}>
                          {getResultIcon(result.appleMusic)} Apple Music
                        </div>
                        {result.appleMusic.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>Already had Apple Music ID</div>
                        ) : result.appleMusic.success ? (
                          <div style={{ color: '#92400e', fontSize: 12 }}>
                            ID: {result.appleMusic.data?.apple_music_id}
                            {result.appleMusic.data?.genres && result.appleMusic.data.genres.length > 0 && (
                              <div>Genres: {result.appleMusic.data.genres.join(', ')}</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>{result.appleMusic.error}</div>
                        )}
                      </div>
                    )}

                    {result.genius && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#ede9fe', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>
                          {getResultIcon(result.genius)} Genius Lyrics URLs
                        </div>
                        {result.genius.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>All tracks already had lyrics URLs</div>
                        ) : result.genius.success ? (
                          <div style={{ fontSize: 12 }}>
                            <div style={{ color: '#7c3aed', marginBottom: 4 }}>
                              Enriched: {result.genius.enrichedCount} tracks
                            </div>
                            {result.genius.failedCount > 0 && (
                              <div style={{ color: '#dc2626' }}>
                                Failed: {result.genius.failedCount} tracks
                                {result.genius.failedTracks && result.genius.failedTracks.length > 0 && (
                                  <div style={{ marginTop: 4, paddingLeft: 8 }}>
                                    {result.genius.failedTracks.slice(0, 3).map((t, i) => (
                                      <div key={i}>{t.position} {t.title}: {t.error}</div>
                                    ))}
                                    {result.genius.failedTracks.length > 3 && (
                                      <div>... and {result.genius.failedTracks.length - 3} more</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>{result.genius.error}</div>
                        )}
                      </div>
                    )}

                    {result.appleLyrics && (
                      <div style={{ marginBottom: 12, padding: 12, background: '#fce7f3', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#be185d', marginBottom: 6 }}>
                          {getResultIcon(result.appleLyrics)} Apple Music Full Lyrics
                        </div>
                        {result.appleLyrics.success ? (
                          <div style={{ fontSize: 12 }}>
                            <div style={{ color: '#be185d', marginBottom: 4 }}>
                              Found: {result.appleLyrics.lyricsFound} tracks
                            </div>
                            {result.appleLyrics.lyricsMissing > 0 && (
                              <div style={{ color: '#6b7280' }}>
                                Missing: {result.appleLyrics.lyricsMissing} tracks
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 4 }}>
                              {result.appleLyrics.error}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                              Check browser console (F12) for detailed error info
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {result.match1001 && (
                      <div style={{ padding: 12, background: '#f5f3ff', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#7c3aed', marginBottom: 6 }}>
                          {getResultIcon(result.match1001)} 1001 Albums Match
                        </div>
                        {result.match1001.skipped ? (
                          <div style={{ color: '#6b7280', fontSize: 12 }}>Already marked as 1001 album</div>
                        ) : result.match1001.success && result.match1001.matched ? (
                          <div style={{ color: '#7c3aed', fontSize: 12 }}>
                            Matched with {result.match1001.confidence}% confidence
                          </div>
                        ) : (
                          <div style={{ color: '#dc2626', fontSize: 12 }}>
                            {result.match1001.error || 'No match found'}
                          </div>
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
          Click to view
        </div>
      )}
    </div>
  );
}