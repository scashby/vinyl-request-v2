// src/app/admin/enrich-sources/page.tsx - COMPLETE with pagination
"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from 'src/lib/supabaseClient';
import Image from 'next/image';

type Album = {
  id: number;
  artist: string;
  title: string;
  image_url: string | null;
  spotify_id: string | null;
  apple_music_id: string | null;
  spotify_label: string | null;
  apple_music_label: string | null;
  enrichment_sources: string[] | null;
  last_enriched_at: string | null;
};

export default function MultiSourceEnrichmentPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState<'all' | 'unenriched' | 'partial'>('unenriched');
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('collection')
      .select('id, artist, title, image_url, spotify_id, apple_music_id, spotify_label, apple_music_label, enrichment_sources, last_enriched_at')
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === 'unenriched') {
      query = query.is('spotify_id', null).is('apple_music_id', null);
    } else if (filter === 'partial') {
      query = query.or('spotify_id.is.null,apple_music_id.is.null');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading albums:', error);
      setStatus('Error loading albums');
    } else {
      setAlbums(data as Album[]);
    }

    setLoading(false);
  }, [filter, limit, offset]);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  async function enrichAlbum(albumId: number) {
    setEnriching(albumId);
    setStatus(`Enriching album ${albumId}...`);

    try {
      const res = await fetch('/api/enrich-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId })
      });

      const result = await res.json() as {
        success: boolean;
        enriched: {
          spotify: boolean;
          appleMusic: boolean;
        };
        error?: string;
      };

      if (result.success) {
        setStatus(`✅ Enriched! Spotify: ${result.enriched.spotify ? '✓' : '✗'}, Apple Music: ${result.enriched.appleMusic ? '✓' : '✗'}`);
        loadAlbums(); // Refresh
      } else {
        setStatus(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEnriching(null);
      setTimeout(() => setStatus(''), 5000);
    }
  }

  async function enrichAllUnenriched() {
    if (!confirm('Enrich all unenriched albums? This may take a while and consume API quota.')) return;

    const unenrichedAlbums = albums.filter(a => !a.spotify_id && !a.apple_music_id);
    
    for (let i = 0; i < unenrichedAlbums.length; i++) {
      const album = unenrichedAlbums[i];
      setStatus(`Enriching ${i + 1}/${unenrichedAlbums.length}: ${album.artist} - ${album.title}`);
      await enrichAlbum(album.id);
      await new Promise(r => setTimeout(r, 2000)); // Rate limit
    }

    setStatus('✅ Batch enrichment complete!');
    loadAlbums();
  }

  const unenrichedCount = albums.filter(a => !a.spotify_id && !a.apple_music_id).length;
  const spotifyOnlyCount = albums.filter(a => a.spotify_id && !a.apple_music_id).length;
  const appleOnlyCount = albums.filter(a => !a.spotify_id && a.apple_music_id).length;
  const fullyEnrichedCount = albums.filter(a => a.spotify_id && a.apple_music_id).length;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>
        🎵 Multi-Source Metadata Enrichment
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Enrich your collection with data from Spotify, Apple Music, and lyrics databases
      </p>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        <StatCard label="Unenriched" value={unenrichedCount} color="#dc2626" />
        <StatCard label="Spotify Only" value={spotifyOnlyCount} color="#f59e0b" />
        <StatCard label="Apple Only" value={appleOnlyCount} color="#8b5cf6" />
        <StatCard label="Fully Enriched" value={fullyEnrichedCount} color="#16a34a" />
      </div>

      {/* Filter & Pagination */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>Show:</label>
        <select
          value={filter}
          onChange={e => {
            setFilter(e.target.value as 'all' | 'unenriched' | 'partial');
            setOffset(0);
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14
          }}
        >
          <option value="all">All Albums</option>
          <option value="unenriched">Unenriched Only</option>
          <option value="partial">Partially Enriched</option>
        </select>

        <label style={{ fontWeight: 600 }}>Per Page:</label>
        <select
          value={limit}
          onChange={e => {
            setLimit(Number(e.target.value));
            setOffset(0);
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14
          }}
        >
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="500">500</option>
        </select>

        {/* Pagination Controls */}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{
              padding: '8px 16px',
              background: offset === 0 ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: offset === 0 ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            ← Previous
          </button>
          <span style={{ 
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 14,
            fontWeight: 600
          }}>
            {offset + 1} - {offset + albums.length}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={albums.length < limit}
            style={{
              padding: '8px 16px',
              background: albums.length < limit ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: albums.length < limit ? 'not-allowed' : 'pointer',
              fontSize: 14
            }}
          >
            Next →
          </button>
        </div>

        <button
          onClick={enrichAllUnenriched}
          disabled={loading || enriching !== null || unenrichedCount === 0}
          style={{
            padding: '8px 16px',
            background: unenrichedCount === 0 ? '#9ca3af' : '#059669',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: unenrichedCount === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ⚡ Enrich All Unenriched ({unenrichedCount})
        </button>
      </div>

      {status && (
        <div style={{
          padding: 12,
          marginBottom: 24,
          background: status.includes('✅') ? '#dcfce7' : status.includes('❌') ? '#fee2e2' : '#dbeafe',
          border: `1px solid ${status.includes('✅') ? '#16a34a' : status.includes('❌') ? '#dc2626' : '#3b82f6'}`,
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500
        }}>
          {status}
        </div>
      )}

      {/* Albums Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>Loading albums...</div>
      ) : albums.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          No albums found with current filter
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16
        }}>
          {albums.map(album => (
            <div
              key={album.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16,
                background: 'white'
              }}
            >
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <Image
                  src={album.image_url || '/placeholder.png'}
                  alt={album.title}
                  width={80}
                  height={80}
                  style={{ borderRadius: 6, objectFit: 'cover' }}
                  unoptimized
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {album.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#6b7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {album.artist}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {album.spotify_id ? (
                      <Badge label="✓ Spotify" active={true} color="#1DB954" />
                    ) : (
                      <Badge label="✗ Spotify" active={false} color="#dc2626" />
                    )}
                    {album.apple_music_id ? (
                      <Badge label="✓ Apple" active={true} color="#FA57C1" />
                    ) : (
                      <Badge label="✗ Apple" active={false} color="#dc2626" />
                    )}
                  </div>
                </div>
              </div>

              {/* Labels */}
              {(album.spotify_label || album.apple_music_label) && (
                <div style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: 12,
                  padding: 8,
                  background: '#f9fafb',
                  borderRadius: 4
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Labels:</div>
                  {album.spotify_label && (
                    <div>🎵 Spotify: {album.spotify_label}</div>
                  )}
                  {album.apple_music_label && (
                    <div>🍎 Apple: {album.apple_music_label}</div>
                  )}
                </div>
              )}

              <button
                onClick={() => enrichAlbum(album.id)}
                disabled={enriching === album.id}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: enriching === album.id ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: enriching === album.id ? 'not-allowed' : 'pointer',
                  fontSize: 13
                }}
              >
                {enriching === album.id ? 'Enriching...' : '🔄 Enrich Now'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: 16,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 32, fontWeight: 'bold', color }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function Badge({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <div style={{
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: active ? color : '#e5e7eb',
      color: active ? 'white' : '#6b7280'
    }}>
      {label}
    </div>
  );
}