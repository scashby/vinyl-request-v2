// src/app/admin/enrich-sources/page.tsx - COMPLETE FILE
"use client";

import { useState, useEffect } from 'react';

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
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
        🎵 Multi-Source Metadata Enrichment
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Enrich your entire collection with data from Spotify, Apple Music, and lyrics databases
      </p>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <StatCard label="Total Albums" value={stats.total} color="#3b82f6" />
        <StatCard label="Needs Enrichment" value={stats.needsEnrichment} color="#f59e0b" />
        <StatCard label="No Data" value={stats.unenriched} color="#dc2626" />
        <StatCard label="Spotify Only" value={stats.spotifyOnly} color="#1DB954" />
        <StatCard label="Apple Only" value={stats.appleOnly} color="#FA57C1" />
        <StatCard label="Fully Enriched" value={stats.fullyEnriched} color="#16a34a" />
        <StatCard label="With Lyrics" value={stats.partialLyrics} color="#7c3aed" />
      </div>

      {/* Controls */}
      <div style={{
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
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
            {enriching ? '⚡ Enriching...' : `⚡ Enrich ${folderFilter ? 'Filtered' : 'All'} Albums`}
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
          📊 How it works:
        </div>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Process albums missing Spotify OR Apple Music (or both)</li>
          <li>Select batch size from 50 to 1000, or &quot;ALL&quot; for no limit</li>
          <li>Fetches missing metadata from Spotify and/or Apple Music</li>
          <li>Enriches ALL tracks with lyrics from Genius</li>
          <li>Progress is saved - safe to stop and resume</li>
          <li><strong>Will process {stats.needsEnrichment.toLocaleString()} albums that need enrichment</strong></li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: 16,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', color }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}