// src/app/admin/edit-entry/[id]/page.tsx - UPDATED WITH APPLE MUSIC LYRICS
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import Image from 'next/image';

type Track = { 
  position: string; 
  title: string; 
  duration: string;
  lyrics_url?: string;
  lyrics?: string;
  lyrics_source?: 'apple_music' | 'genius';
};

type CollectionEntry = {
  id: string;
  artist: string | null;
  title: string | null;
  year: string | null;
  folder: string | null;
  format: string | null;
  image_url: string | null;
  media_condition: string | null;
  sell_price: string | null;
  steves_top_200: boolean | null;
  this_weeks_top_10: boolean | null;
  inner_circle_preferred: boolean | null;
  blocked: boolean | null;
  blocked_sides: string[] | null;
  tracklists: string | null;
  discogs_release_id: string | null;
  discogs_genres: string[] | null;
  discogs_styles: string[] | null;
  decade: number | null;
  master_release_id: string | null;
  master_release_date: string | null;
  spotify_id?: string | null;
  spotify_url?: string | null;
  apple_music_id?: string | null;
  apple_music_url?: string | null;
  [key: string]: unknown;
};

type DiscogsData = {
  year?: string | number;
  images?: { uri: string }[];
  tracklist?: { position?: string; title?: string; duration?: string }[];
  genres?: string[];
  styles?: string[];
  master_id?: number;
  master_url?: string;
  [key: string]: unknown;
};

type DiscogsMasterData = {
  year?: string | number;
  main_release?: number;
  [key: string]: unknown;
};

type MissingField = {
  field: string;
  label: string;
  isEmpty: boolean;
};

function calculateDecade(year: string | null): number | null {
  if (!year) return null;
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum)) return null;
  return Math.floor(yearNum / 10) * 10;
}

async function fetchDiscogsRelease(releaseId: string): Promise<DiscogsData> {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error('Discogs fetch failed');
  return await res.json() as DiscogsData;
}

async function fetchDiscogsMaster(masterId: string): Promise<DiscogsMasterData> {
  const res = await fetch(`https://api.discogs.com/masters/${masterId}`, {
    headers: {
      'User-Agent': 'DeadwaxDialogues/1.0',
      'Authorization': `Discogs token=${process.env.NEXT_PUBLIC_DISCOGS_TOKEN}`
    }
  });
  if (!res.ok) throw new Error('Discogs master fetch failed');
  return await res.json() as DiscogsMasterData;
}

function cleanTrack(track: Partial<Track>): Track {
  return {
    position: track.position || '',
    title: track.title || '',
    duration: track.duration || '',
    lyrics_url: track.lyrics_url,
    lyrics: track.lyrics,
    lyrics_source: track.lyrics_source
  };
}

export default function EditEntryPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [entry, setEntry] = useState<CollectionEntry | null>(null);
  const [status, setStatus] = useState('');
  const [blockedSides, setBlockedSides] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [fetching, setFetching] = useState(false);
  const [enrichingMulti, setEnrichingMulti] = useState(false);
  const [fetchingAppleLyrics, setFetchingAppleLyrics] = useState(false);

  useEffect(() => {
    fetchEntry(id).then((data) => {
      setEntry(data);
      setBlockedSides(Array.isArray(data?.blocked_sides) ? data.blocked_sides : []);
      let tl: unknown[] = [];
      if (data?.tracklists) {
        try { tl = JSON.parse(data.tracklists); } catch { tl = []; }
      }
      setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
    });
  }, [id]);

  async function fetchEntry(rowId: string): Promise<CollectionEntry> {
    const { data } = await supabase.from('collection').select('*').eq('id', rowId).single();
    return data as CollectionEntry;
  }

  // Detect missing Discogs metadata
  const missingDiscogsFields: MissingField[] = [
    { field: 'discogs_genres', label: 'Genres', isEmpty: !entry?.discogs_genres || entry.discogs_genres.length === 0 },
    { field: 'discogs_styles', label: 'Styles', isEmpty: !entry?.discogs_styles || entry.discogs_styles.length === 0 },
    { field: 'decade', label: 'Decade', isEmpty: !entry?.decade },
    { field: 'tracklists', label: 'Tracklist', isEmpty: !tracks || tracks.length === 0 },
    { field: 'image_url', label: 'Image', isEmpty: !entry?.image_url },
    { field: 'master_release_date', label: 'Master Release Date', isEmpty: !entry?.master_release_date }
  ];

  const hasMissingDiscogs = missingDiscogsFields.some(f => f.isEmpty);

  // Detect missing multi-source metadata
  const missingMultiSourceFields: MissingField[] = [
    { field: 'spotify_id', label: 'Spotify', isEmpty: !entry?.spotify_id },
    { field: 'apple_music_id', label: 'Apple Music', isEmpty: !entry?.apple_music_id }
  ];

  const hasMissingMultiSource = missingMultiSourceFields.some(f => f.isEmpty);

  // Check if we can fetch Apple Music lyrics
  const canFetchAppleLyrics = entry?.apple_music_id && tracks.length > 0;
  const hasAppleLyrics = tracks.some(t => t.lyrics && t.lyrics_source === 'apple_music');
  const appleLyricsCount = tracks.filter(t => t.lyrics && t.lyrics_source === 'apple_music').length;
  const geniusLyricsCount = tracks.filter(t => t.lyrics_url).length;

  async function fetchAppleMusicLyrics() {
    if (!entry?.apple_music_id) {
      setStatus('No Apple Music ID - cannot fetch lyrics');
      return;
    }

    setFetchingAppleLyrics(true);
    setStatus('Fetching lyrics from Apple Music...');

    try {
      const res = await fetch('/api/fetch-apple-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();

      if (!result.success) {
        setStatus(`❌ Apple Music lyrics fetch failed: ${result.error}`);
        return;
      }

      // Reload the entry to get updated tracks
      const updatedEntry = await fetchEntry(id);
      setEntry(updatedEntry);
      
      if (updatedEntry.tracklists) {
        try {
          const tl = JSON.parse(updatedEntry.tracklists);
          setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
        } catch {
          // Keep existing tracks
        }
      }

      const { stats } = result;
      setStatus(`✅ Apple Music: Found lyrics for ${stats.lyricsFound} out of ${stats.totalTracks} tracks`);
    } catch (err) {
      setStatus(`❌ Apple Music lyrics fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFetchingAppleLyrics(false);
    }
  }

  async function fetchAllMissingMetadata() {
    if (!entry?.discogs_release_id) {
      setStatus('No Discogs Release ID - cannot fetch metadata');
      return;
    }

    setFetching(true);
    setStatus('Fetching missing metadata from Discogs...');

    try {
      const data = await fetchDiscogsRelease(entry.discogs_release_id);
      let updated = false;

      if (!entry.discogs_genres || entry.discogs_genres.length === 0) {
        if (data.genres && data.genres.length > 0) {
          handleChange('discogs_genres', data.genres);
          updated = true;
        }
      }

      if (!entry.discogs_styles || entry.discogs_styles.length === 0) {
        if (data.styles && data.styles.length > 0) {
          handleChange('discogs_styles', data.styles);
          updated = true;
        }
      }

      if (!tracks || tracks.length === 0) {
        if (data.tracklist && data.tracklist.length > 0) {
          const newTracks = data.tracklist.map(cleanTrack);
          setTracks(newTracks);
          handleChange('tracklists', JSON.stringify(newTracks));
          updated = true;
        }
      }

      if (!entry.image_url && data.images?.[0]?.uri) {
        handleChange('image_url', data.images[0].uri);
        updated = true;
      }

      if (!entry.master_release_date) {
        if (data.master_id || data.master_url) {
          const masterId = data.master_id || data.master_url?.split('/').pop();
          if (masterId) {
            try {
              const masterData = await fetchDiscogsMaster(String(masterId));
              if (masterData.year) {
                handleChange('master_release_id', String(masterId));
                handleChange('master_release_date', String(masterData.year));
                
                const decade = calculateDecade(String(masterData.year));
                if (decade) {
                  handleChange('decade', decade);
                }
                
                updated = true;
              }
            } catch (err) {
              console.warn('Could not fetch master release:', err);
            }
          }
        }
      }

      if (!entry.decade) {
        const yearToUse = entry.master_release_date || entry.year;
        if (yearToUse) {
          const decade = calculateDecade(yearToUse);
          if (decade) {
            handleChange('decade', decade);
            updated = true;
          }
        }
      }

      setStatus(updated ? '✅ Updated missing metadata from Discogs' : 'ℹ️ No missing fields to update');
    } catch (err) {
      setStatus(`❌ Failed to fetch metadata: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setFetching(false);
    }
  }

  async function enrichMultiSource() {
    if (!entry) return;

    setEnrichingMulti(true);
    setStatus('Enriching from Spotify, Apple Music, and Genius...');

    try {
      const res = await fetch('/api/enrich-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();

      if (!result.success) {
        setStatus(`❌ Enrichment failed: ${result.error}`);
        return;
      }

      // Reload the entry to get updated data
      const updatedEntry = await fetchEntry(id);
      setEntry(updatedEntry);
      
      // Reload tracks
      if (updatedEntry.tracklists) {
        try {
          const tl = JSON.parse(updatedEntry.tracklists);
          setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
        } catch {
          // Keep existing tracks
        }
      }

      const enrichedParts = [];
      if (result.enriched?.spotify) enrichedParts.push('Spotify');
      if (result.enriched?.appleMusic) enrichedParts.push('Apple Music');
      if (result.enriched?.appleLyrics) enrichedParts.push('Apple Lyrics');
      if (result.enriched?.lyrics) enrichedParts.push('Genius Lyrics');

      if (enrichedParts.length > 0) {
        setStatus(`✅ Enriched with: ${enrichedParts.join(', ')}`);
      } else {
        setStatus('ℹ️ No new data found from services');
      }
    } catch (err) {
      setStatus(`❌ Enrichment failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEnrichingMulti(false);
    }
  }

  if (!entry) {
    return (
      <div style={{ 
        maxWidth: 750, 
        margin: '32px auto', 
        padding: 24, 
        background: '#fff', 
        borderRadius: 8, 
        color: "#222",
        textAlign: 'center'
      }}>
        Loading...
      </div>
    );
  }

  function handleChange(field: string, value: unknown) {
    setEntry((e) => ({ ...(e as CollectionEntry), [field]: value }));
  }

  function handleBlockSide(side: string) {
    setBlockedSides((bs) =>
      bs.includes(side) ? bs.filter((s) => s !== side) : [...bs, side]
    );
  }

  function handleTrackChange(i: number, key: keyof Track, value: string) {
    setTracks((tks) => tks.map((t, j) => j === i ? { ...t, [key]: value } : t));
  }

  function addTrack() {
    setTracks((tks) => [...tks, { position: '', title: '', duration: '' }]);
  }
  
  function removeTrack(i: number) {
    setTracks((tks) => tks.filter((_, j) => j !== i));
  }

  async function handleSave() {
    if (!entry) return;
    setSaving(true);
    setStatus('Saving...');
    
    const update = {
      artist: entry.artist || '',
      title: entry.title || '',
      year: entry.year || '',
      folder: entry.folder || '',
      format: entry.format || '',
      image_url: entry.image_url || '',
      media_condition: entry.media_condition || '',
      sell_price: entry.sell_price || null,
      steves_top_200: !!entry.steves_top_200,
      this_weeks_top_10: !!entry.this_weeks_top_10,
      inner_circle_preferred: !!entry.inner_circle_preferred,
      blocked_sides: blockedSides || [],
      blocked: !!entry.blocked,
      tracklists: JSON.stringify(tracks),
      discogs_release_id: entry.discogs_release_id || '',
      discogs_genres: entry.discogs_genres || null,
      discogs_styles: entry.discogs_styles || null,
      decade: entry.decade || null,
      master_release_id: entry.master_release_id || null,
      master_release_date: entry.master_release_date || null,
    };
    
    const { error } = await supabase.from('collection').update(update).eq('id', entry.id);
    
    if (error) {
      console.error('Supabase error:', error);
      setStatus(`Error: ${error.message}`);
      setSaving(false);
    } else {
      setStatus('✅ Saved successfully!');
      setSaving(false);
      setTimeout(() => {
        router.push('/admin/edit-collection');
      }, 1000);
    }
  }

  const sides = Array.from(
    new Set(tracks.map(t => t.position?.[0]).filter(Boolean))
  );

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  const buttonStyle = {
    padding: '6px 12px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#f9fafb',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    background: '#2563eb',
    color: 'white',
    border: '1px solid #2563eb',
    fontWeight: '500',
  };

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '32px auto', 
      padding: 32, 
      background: '#fff', 
      borderRadius: 12, 
      color: "#222",
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h2 style={{ color: "#222", margin: 0, fontSize: '24px', fontWeight: '600' }}>
              Edit Entry #{entry.id}
            </h2>
            <p style={{ color: "#6b7280", margin: '8px 0 0 0', fontSize: '14px' }}>
              {entry.artist} - {entry.title}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Discogs Enrichment */}
            {hasMissingDiscogs && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: 16,
                maxWidth: 300
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: 8 }}>
                  ⚠️ Missing Discogs Data
                </div>
                <div style={{ fontSize: '12px', color: '#78350f', marginBottom: 12 }}>
                  {missingDiscogsFields.filter(f => f.isEmpty).map(f => f.label).join(', ')}
                </div>
                <button
                  onClick={fetchAllMissingMetadata}
                  disabled={fetching || !entry.discogs_release_id}
                  style={{
                    ...primaryButtonStyle,
                    width: '100%',
                    background: fetching ? '#9ca3af' : '#f59e0b',
                    border: fetching ? 'none' : '1px solid #f59e0b',
                    cursor: fetching ? 'not-allowed' : 'pointer'
                  }}
                >
                  {fetching ? 'Fetching...' : '🔄 Fetch from Discogs'}
                </button>
              </div>
            )}

            {/* Multi-Source Enrichment */}
            {hasMissingMultiSource && (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #3b82f6',
                borderRadius: 8,
                padding: 16,
                maxWidth: 300
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>
                  🎵 Missing Streaming Data
                </div>
                <div style={{ fontSize: '12px', color: '#1e3a8a', marginBottom: 12 }}>
                  {missingMultiSourceFields.filter(f => f.isEmpty).map(f => f.label).join(', ')}
                </div>
                <button
                  onClick={enrichMultiSource}
                  disabled={enrichingMulti}
                  style={{
                    ...primaryButtonStyle,
                    width: '100%',
                    background: enrichingMulti ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    cursor: enrichingMulti ? 'not-allowed' : 'pointer'
                  }}
                >
                  {enrichingMulti ? 'Enriching...' : '⚡ Enrich Spotify/Apple'}
                </button>
              </div>
            )}

            {/* Apple Music Lyrics */}
            {canFetchAppleLyrics && !hasAppleLyrics && (
              <div style={{
                background: '#fce7f3',
                border: '1px solid #ec4899',
                borderRadius: 8,
                padding: 16,
                maxWidth: 300
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#9f1239', marginBottom: 8 }}>
                  🍎 Apple Music Lyrics
                </div>
                <div style={{ fontSize: '12px', color: '#9f1239', marginBottom: 12 }}>
                  Fetch full lyrics text from Apple Music
                </div>
                <button
                  onClick={fetchAppleMusicLyrics}
                  disabled={fetchingAppleLyrics}
                  style={{
                    ...primaryButtonStyle,
                    width: '100%',
                    background: fetchingAppleLyrics ? '#9ca3af' : '#ec4899',
                    border: 'none',
                    cursor: fetchingAppleLyrics ? 'not-allowed' : 'pointer'
                  }}
                >
                  {fetchingAppleLyrics ? 'Fetching...' : '🍎 Fetch Apple Lyrics'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Show enrichment status */}
        {(entry.spotify_id || entry.apple_music_id || hasAppleLyrics) && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#f0fdf4',
            border: '1px solid #16a34a',
            borderRadius: 6,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            fontSize: 13,
            flexWrap: 'wrap'
          }}>
            <span style={{ fontWeight: 600, color: '#15803d' }}>✅ Enriched with:</span>
            {entry.spotify_id && (
              <a 
                href={entry.spotify_url || `https://open.spotify.com/album/${entry.spotify_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '4px 8px',
                  background: '#dcfce7',
                  color: '#15803d',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                Spotify →
              </a>
            )}
            {entry.apple_music_id && (
              <a
                href={entry.apple_music_url || `https://music.apple.com/album/${entry.apple_music_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '4px 8px',
                  background: '#fce7f3',
                  color: '#be185d',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                Apple Music →
              </a>
            )}
            {hasAppleLyrics && (
              <span style={{
                padding: '4px 8px',
                background: '#fce7f3',
                color: '#be185d',
                borderRadius: 4,
                fontWeight: 600
              }}>
                🍎 {appleLyricsCount} Apple Music lyrics
              </span>
            )}
            {geniusLyricsCount > 0 && (
              <span style={{
                padding: '4px 8px',
                background: '#e9d5ff',
                color: '#7c3aed',
                borderRadius: 4,
                fontWeight: 600
              }}>
                📝 {geniusLyricsCount} Genius links
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 32, alignItems: 'flex-start' }}>
        
        {/* Left Column - Basic Info */}
        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>
            Basic Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Artist</label>
              <input 
                style={inputStyle}
                value={entry.artist || ''} 
                onChange={e => handleChange('artist', e.target.value)} 
                placeholder="Enter artist name"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Title</label>
              <input 
                style={inputStyle}
                value={entry.title || ''} 
                onChange={e => handleChange('title', e.target.value)}
                placeholder="Enter album title" 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                This Release Year
              </label>
              <input 
                style={inputStyle}
                value={entry.year || ''} 
                onChange={e => {
                  handleChange('year', e.target.value);
                  if (!entry.master_release_date) {
                    const decade = calculateDecade(e.target.value);
                    if (decade) handleChange('decade', decade);
                  }
                }}
                placeholder="e.g. 1969" 
              />
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                Year of this specific pressing/release
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                Master Release Year
              </label>
              <input 
                style={inputStyle}
                value={entry.master_release_date || ''} 
                onChange={e => {
                  handleChange('master_release_date', e.target.value);
                  const decade = calculateDecade(e.target.value);
                  if (decade) handleChange('decade', decade);
                }}
                placeholder="e.g. 1967" 
              />
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                Original first release year (decade calculated from this)
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Folder</label>
              <input 
                style={inputStyle}
                value={entry.folder || ''} 
                onChange={e => handleChange('folder', e.target.value)}
                placeholder="Collection folder" 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Format</label>
              <input 
                style={inputStyle}
                value={entry.format || ''} 
                onChange={e => handleChange('format', e.target.value)}
                placeholder="e.g. Vinyl, LP, 12 inch" 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Media Condition</label>
              <input 
                style={inputStyle}
                value={entry.media_condition || ''} 
                onChange={e => handleChange('media_condition', e.target.value)}
                placeholder="e.g. VG+, NM, M" 
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                💰 Sell Price
              </label>
              <input 
                style={inputStyle}
                value={entry.sell_price || ''} 
                onChange={e => handleChange('sell_price', e.target.value)}
                placeholder="e.g. $25.00 or NFS"
              />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
                Enter price like &quot;$25.00&quot; or &quot;NFS&quot;
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Image URL</label>
              <input 
                style={inputStyle}
                value={entry.image_url || ''} 
                onChange={e => handleChange('image_url', e.target.value)}
                placeholder="Cover image URL" 
              />
              {entry.image_url && (
                <div style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 8, 
                  display: 'flex', 
                  justifyContent: 'center',
                  marginTop: 12
                }}>
                  <Image
                    src={entry.image_url}
                    alt="cover"
                    width={120}
                    height={120}
                    style={{ borderRadius: 8, objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    unoptimized
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column - Metadata */}
        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>
            Metadata
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                Genres {!entry.discogs_genres || entry.discogs_genres.length === 0 ? '⚠️' : '✓'}
              </label>
              <input 
                style={inputStyle}
                value={entry.discogs_genres?.join(', ') || ''} 
                onChange={e => handleChange('discogs_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Rock, Jazz, Electronic"
              />
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                Comma-separated genres
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                Styles {!entry.discogs_styles || entry.discogs_styles.length === 0 ? '⚠️' : '✓'}
              </label>
              <input 
                style={inputStyle}
                value={entry.discogs_styles?.join(', ') || ''} 
                onChange={e => handleChange('discogs_styles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Progressive Rock, Modal, Ambient"
              />
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                Comma-separated styles
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                Decade {!entry.decade ? '⚠️' : '✓'}
              </label>
              <input 
                style={inputStyle}
                value={entry.decade || ''} 
                onChange={e => handleChange('decade', parseInt(e.target.value) || null)}
                placeholder="1970"
                type="number"
                step="10"
              />
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>
                Auto-calculated from master release year
              </div>
            </div>

            <div style={{ 
              padding: 16, 
              background: '#f0f9ff', 
              borderRadius: 8, 
              border: '1px solid #0369a1' 
            }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#0c4a6e' }}>
                🏆 Special Badges
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', color: "#374151", cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!entry.steves_top_200}
                    onChange={e => handleChange('steves_top_200', e.target.checked)}
                    style={{ marginRight: 8, transform: 'scale(1.1)' }}
                  />
                  <span style={{ fontWeight: '600', color: '#dc2626' }}>⭐ Steve&apos;s Top 200</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', color: "#374151", cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!entry.this_weeks_top_10}
                    onChange={e => handleChange('this_weeks_top_10', e.target.checked)}
                    style={{ marginRight: 8, transform: 'scale(1.1)' }}
                  />
                  <span style={{ fontWeight: '600', color: '#ea580c' }}>🔥 This Week&apos;s Top 10</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', color: "#374151", cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!entry.inner_circle_preferred}
                    onChange={e => handleChange('inner_circle_preferred', e.target.checked)}
                    style={{ marginRight: 8, transform: 'scale(1.1)' }}
                  />
                  <span style={{ fontWeight: '600', color: '#7c3aed' }}>💎 Inner Circle Preferred</span>
                </label>
              </div>
            </div>

            <div style={{ 
              padding: 16, 
              background: '#fef3c7', 
              borderRadius: 8, 
              border: '1px solid #f59e0b' 
            }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#92400e' }}>
                Blocking Options
              </h4>
              
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: 12, color: "#374151", cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!entry.blocked}
                  onChange={e => handleChange('blocked', e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                <strong>Block Entire Album</strong>
              </label>
              
              {sides.length > 0 && (
                <div>
                  <div style={{ fontWeight: '600', marginBottom: 8, color: "#374151" }}>Block Individual Sides:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sides.map(side => (
                      <label 
                        key={side} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '6px 12px',
                          background: blockedSides.includes(side) ? '#fee2e2' : '#fff',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={blockedSides.includes(side)}
                          onChange={() => handleBlockSide(side)}
                          style={{ marginRight: 6 }}
                        />
                        Side {side}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Tracklist */}
        <div style={{ color: "#222" }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>
              Tracklist {!tracks || tracks.length === 0 ? '⚠️' : '✓'}
            </h3>
            
            <div style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: 8, 
              overflow: 'hidden',
              maxHeight: 600,
              overflowY: 'auto'
            }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Pos</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Duration</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Lyrics</th>
                    <th style={{ padding: '12px 8px', width: 40, borderBottom: '1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t, i) => (
                    <tr key={i} style={{ borderBottom: i < tracks.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '8px' }}>
                        <input 
                          value={t.position} 
                          onChange={e => handleTrackChange(i, 'position', e.target.value)} 
                          style={{ 
                            ...inputStyle, 
                            width: 50, 
                            padding: '4px 6px', 
                            fontSize: '12px',
                            textAlign: 'center'
                          }} 
                          placeholder="A1"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          value={t.title} 
                          onChange={e => handleTrackChange(i, 'title', e.target.value)} 
                          style={{ 
                            ...inputStyle, 
                            padding: '4px 6px', 
                            fontSize: '12px'
                          }} 
                          placeholder="Track title"
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          value={t.duration} 
                          onChange={e => handleTrackChange(i, 'duration', e.target.value)} 
                          style={{ 
                            ...inputStyle, 
                            width: 70, 
                            padding: '4px 6px', 
                            fontSize: '12px',
                            textAlign: 'center'
                          }} 
                          placeholder="3:45"
                        />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {t.lyrics && t.lyrics_source === 'apple_music' && (
                          <span 
                            style={{ fontSize: 16, cursor: 'help' }}
                            title="Has Apple Music lyrics"
                          >
                            🍎
                          </span>
                        )}
                        {t.lyrics_url && (
                          <a 
                            href={t.lyrics_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: 16, textDecoration: 'none', marginLeft: t.lyrics ? 4 : 0 }}
                            title="View lyrics on Genius"
                          >
                            📝
                          </a>
                        )}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeTrack(i)} 
                          style={{ 
                            color: "#dc2626", 
                            background: 'none', 
                            border: 'none', 
                            fontSize: 16, 
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Remove track"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button 
              type="button" 
              onClick={addTrack} 
              style={{ 
                ...buttonStyle, 
                marginTop: 12, 
                width: '100%',
                background: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #0369a1'
              }}
            >
              + Add Track
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ 
        marginTop: 32, 
        paddingTop: 24, 
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            style={{
              ...primaryButtonStyle,
              padding: '12px 24px',
              fontSize: '14px',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button 
            onClick={() => router.push('/admin/edit-collection')}
            style={{
              ...buttonStyle,
              padding: '12px 24px',
              fontSize: '14px'
            }}
          >
            Back to Collection
          </button>
        </div>
        
        {status && (
          <div style={{ 
            color: status.includes('❌') ? '#dc2626' : status.includes('✅') ? '#059669' : '#374151',
            fontWeight: '500',
            fontSize: '14px'
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}