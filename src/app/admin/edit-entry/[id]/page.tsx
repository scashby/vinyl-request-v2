// src/app/admin/edit-entry/[id]/page.tsx - COMPLETE FILE WITH SALE FUNCTIONALITY
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
  spotify_id: string | null;
  spotify_url: string | null;
  spotify_popularity: number | null;
  spotify_genres: string[] | null;
  spotify_label: string | null;
  spotify_release_date: string | null;
  spotify_total_tracks: number | null;
  spotify_image_url: string | null;
  apple_music_id: string | null;
  apple_music_url: string | null;
  apple_music_genre: string | null;
  apple_music_genres: string[] | null;
  apple_music_label: string | null;
  apple_music_release_date: string | null;
  apple_music_track_count: number | null;
  apple_music_artwork_url: string | null;
  for_sale: boolean;
  sale_price: number | null;
  sale_platform: string | null;
  sale_quantity: number | null;
  sale_notes: string | null;
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

const PLATFORMS = [
  { value: 'discogs', label: 'Discogs' },
  { value: 'shopify', label: 'Shopify Store' },
  { value: 'ebay', label: 'eBay' },
  { value: 'reverb', label: 'Reverb LP' },
  { value: 'other', label: 'Other' }
];

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
  
  const [fetchingDiscogs, setFetchingDiscogs] = useState(false);
  const [enrichingSpotify, setEnrichingSpotify] = useState(false);
  const [enrichingAppleMusic, setEnrichingAppleMusic] = useState(false);
  const [enrichingGenius, setEnrichingGenius] = useState(false);
  const [fetchingAppleLyrics, setFetchingAppleLyrics] = useState(false);

  // Sale state
  const [forSale, setForSale] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleNotes, setSaleNotes] = useState('');

  useEffect(() => {
    fetchEntry(id).then((data) => {
      setEntry(data);
      setBlockedSides(Array.isArray(data?.blocked_sides) ? data.blocked_sides : []);
      let tl: unknown[] = [];
      if (data?.tracklists) {
        try { tl = JSON.parse(data.tracklists); } catch { tl = []; }
      }
      setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
      
      // Load sale data
      setForSale(data.for_sale || false);
      setSalePrice(data.sale_price?.toString() || '');
      setSalePlatform(data.sale_platform || '');
      setSaleQuantity(data.sale_quantity?.toString() || '1');
      setSaleNotes(data.sale_notes || '');
    });
  }, [id]);

  async function fetchEntry(rowId: string): Promise<CollectionEntry> {
    const { data } = await supabase.from('collection').select('*').eq('id', rowId).single();
    return data as CollectionEntry;
  }

  const missingSpotify = !entry?.spotify_id;
  const missingAppleMusic = !entry?.apple_music_id;
  const canFetchGenius = tracks.length > 0;
  const canFetchAppleLyrics = entry?.apple_music_id && tracks.length > 0;
  
  const missingDiscogsFields = [
    { field: 'discogs_genres', label: 'Genres', isEmpty: !entry?.discogs_genres || entry.discogs_genres.length === 0 },
    { field: 'discogs_styles', label: 'Styles', isEmpty: !entry?.discogs_styles || entry.discogs_styles.length === 0 },
    { field: 'decade', label: 'Decade', isEmpty: !entry?.decade },
    { field: 'tracklists', label: 'Tracklist', isEmpty: !tracks || tracks.length === 0 },
    { field: 'image_url', label: 'Image', isEmpty: !entry?.image_url },
    { field: 'master_release_date', label: 'Master Release Date', isEmpty: !entry?.master_release_date }
  ];
  const hasMissingDiscogs = missingDiscogsFields.some(f => f.isEmpty);
  
  const hasAppleLyrics = tracks.some(t => t.lyrics && t.lyrics_source === 'apple_music');
  const appleLyricsCount = tracks.filter(t => t.lyrics && t.lyrics_source === 'apple_music').length;
  const geniusLyricsCount = tracks.filter(t => t.lyrics_url).length;

  async function fetchDiscogsMetadata() {
    if (!entry?.discogs_release_id) {
      setStatus('No Discogs Release ID');
      return;
    }

    setFetchingDiscogs(true);
    setStatus('Fetching from Discogs...');

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
                if (decade) handleChange('decade', decade);
                updated = true;
              }
            } catch (err) {
              console.warn('Could not fetch master:', err);
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

      setStatus(updated ? '✅ Updated from Discogs' : 'ℹ️ No updates needed');
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setFetchingDiscogs(false);
    }
  }

  async function enrichSpotify() {
    if (!entry || entry.spotify_id) return;

    setEnrichingSpotify(true);
    setStatus('Searching Spotify...');

    try {
      const res = await fetch('/api/enrich-sources/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();
      
      if (result.success && !result.skipped) {
        const updatedEntry = await fetchEntry(id);
        setEntry(updatedEntry);
        setStatus('✅ Added Spotify');
      } else {
        setStatus(`❌ ${result.error || 'Not found'}`);
      }
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setEnrichingSpotify(false);
    }
  }

  async function enrichAppleMusic() {
    if (!entry || entry.apple_music_id) return;

    setEnrichingAppleMusic(true);
    setStatus('Searching Apple Music...');

    try {
      const res = await fetch('/api/enrich-sources/apple-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();
      
      if (result.success && !result.skipped) {
        const updatedEntry = await fetchEntry(id);
        setEntry(updatedEntry);
        setStatus('✅ Added Apple Music');
      } else {
        setStatus(`❌ ${result.error || 'Not found'}`);
      }
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setEnrichingAppleMusic(false);
    }
  }

  async function enrichGenius() {
    if (!entry || !tracks || tracks.length === 0) return;

    setEnrichingGenius(true);
    setStatus('Searching Genius...');

    try {
      const res = await fetch('/api/enrich-sources/genius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();
      
      if (result.success && result.data?.enrichedCount > 0) {
        const updatedEntry = await fetchEntry(id);
        setEntry(updatedEntry);
        if (updatedEntry.tracklists) {
          try {
            const tl = JSON.parse(updatedEntry.tracklists);
            setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
          } catch {
            // Keep existing
          }
        }
        setStatus(`✅ Added ${result.data.enrichedCount} Genius links`);
      } else {
        setStatus('ℹ️ No new links found');
      }
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setEnrichingGenius(false);
    }
  }

  async function fetchAppleMusicLyrics() {
    if (!entry?.apple_music_id) {
      setStatus('No Apple Music ID');
      return;
    }

    setFetchingAppleLyrics(true);
    setStatus('Fetching Apple lyrics...');

    try {
      const res = await fetch('/api/enrich-sources/apple-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: parseInt(entry.id) })
      });

      const result = await res.json();

      if (!result.success) {
        setStatus(`❌ ${result.error}`);
        return;
      }

      const updatedEntry = await fetchEntry(id);
      setEntry(updatedEntry);
      
      if (updatedEntry.tracklists) {
        try {
          const tl = JSON.parse(updatedEntry.tracklists);
          setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
        } catch {
          // Keep existing
        }
      }

      const { stats } = result;
      setStatus(`✅ ${stats.lyricsFound}/${stats.totalTracks} lyrics`);
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setFetchingAppleLyrics(false);
    }
  }

  if (!entry) {
    return <div style={{ maxWidth: 750, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 8, color: "#222", textAlign: 'center' }}>Loading...</div>;
  }

  function handleChange(field: string, value: unknown) {
    setEntry((e) => ({ ...(e as CollectionEntry), [field]: value }));
  }

  function handleBlockSide(side: string) {
    setBlockedSides((bs) => bs.includes(side) ? bs.filter((s) => s !== side) : [...bs, side]);
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
      spotify_id: entry.spotify_id || null,
      spotify_url: entry.spotify_url || null,
      spotify_popularity: entry.spotify_popularity || null,
      spotify_genres: entry.spotify_genres || null,
      spotify_label: entry.spotify_label || null,
      spotify_release_date: entry.spotify_release_date || null,
      spotify_total_tracks: entry.spotify_total_tracks || null,
      spotify_image_url: entry.spotify_image_url || null,
      apple_music_id: entry.apple_music_id || null,
      apple_music_url: entry.apple_music_url || null,
      apple_music_genre: entry.apple_music_genre || null,
      apple_music_genres: entry.apple_music_genres || null,
      apple_music_label: entry.apple_music_label || null,
      apple_music_release_date: entry.apple_music_release_date || null,
      apple_music_track_count: entry.apple_music_track_count || null,
      apple_music_artwork_url: entry.apple_music_artwork_url || null,
      for_sale: forSale,
      sale_price: forSale && salePrice ? parseFloat(salePrice) : null,
      sale_platform: forSale && salePlatform ? salePlatform : null,
      sale_quantity: forSale && saleQuantity ? parseInt(saleQuantity) : null,
      sale_notes: forSale && saleNotes ? saleNotes : null
    };
    
    const { error } = await supabase.from('collection').update(update).eq('id', entry.id);
    
    if (error) {
      setStatus(`Error: ${error.message}`);
      setSaving(false);
    } else {
      setStatus('✅ Saved!');
      setSaving(false);
      setTimeout(() => router.push('/admin/edit-collection'), 1000);
    }
  }

  const sides = Array.from(new Set(tracks.map(t => t.position?.[0]).filter(Boolean)));

  const inputStyle = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const };
  const buttonStyle = { padding: '8px 16px', fontSize: '13px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' };

  return (
    <div style={{ maxWidth: 1600, margin: '32px auto', padding: 32, background: '#fff', borderRadius: 12, color: "#222", boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
      <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: "#222", margin: 0, fontSize: '24px', fontWeight: '600' }}>Edit Entry #{entry.id}</h2>
            <p style={{ color: "#6b7280", margin: '8px 0 0 0', fontSize: '14px' }}>{entry.artist} - {entry.title}</p>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {hasMissingDiscogs && <button onClick={fetchDiscogsMetadata} disabled={fetchingDiscogs} style={{ ...buttonStyle, background: fetchingDiscogs ? '#9ca3af' : '#f59e0b', color: 'white' }}>{fetchingDiscogs ? '⏳ Discogs...' : '🔄 Fetch Discogs'}</button>}
            {missingSpotify && <button onClick={enrichSpotify} disabled={enrichingSpotify} style={{ ...buttonStyle, background: enrichingSpotify ? '#9ca3af' : '#1DB954', color: 'white' }}>{enrichingSpotify ? '⏳ Spotify...' : '🎵 Add Spotify'}</button>}
            {missingAppleMusic && <button onClick={enrichAppleMusic} disabled={enrichingAppleMusic} style={{ ...buttonStyle, background: enrichingAppleMusic ? '#9ca3af' : '#FA57C1', color: 'white' }}>{enrichingAppleMusic ? '⏳ Apple...' : '🍎 Add Apple'}</button>}
            {canFetchGenius && <button onClick={enrichGenius} disabled={enrichingGenius} style={{ ...buttonStyle, background: enrichingGenius ? '#9ca3af' : '#7c3aed', color: 'white' }}>{enrichingGenius ? '⏳ Genius...' : '📝 Add Genius'}</button>}
            {canFetchAppleLyrics && !hasAppleLyrics && <button onClick={fetchAppleMusicLyrics} disabled={fetchingAppleLyrics} style={{ ...buttonStyle, background: fetchingAppleLyrics ? '#9ca3af' : '#ec4899', color: 'white' }}>{fetchingAppleLyrics ? '⏳ Lyrics...' : '🍎 Fetch Lyrics'}</button>}
          </div>
        </div>

        {(entry.spotify_id || entry.apple_music_id || hasAppleLyrics) && (
          <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#15803d' }}>✅ Enriched:</span>
            {entry.spotify_id && <a href={entry.spotify_url || `https://open.spotify.com/album/${entry.spotify_id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 8px', background: '#dcfce7', color: '#15803d', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>Spotify</a>}
            {entry.apple_music_id && <a href={entry.apple_music_url || `https://music.apple.com/album/${entry.apple_music_id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '4px 8px', background: '#fce7f3', color: '#be185d', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>Apple Music</a>}
            {hasAppleLyrics && <span style={{ padding: '4px 8px', background: '#fce7f3', color: '#be185d', borderRadius: 4, fontWeight: 600 }}>🍎 {appleLyricsCount} lyrics</span>}
            {geniusLyricsCount > 0 && <span style={{ padding: '4px 8px', background: '#e9d5ff', color: '#7c3aed', borderRadius: 4, fontWeight: 600 }}>📝 {geniusLyricsCount} links</span>}
          </div>
        )}

        {status && <div style={{ marginTop: 16, padding: 12, background: status.includes('❌') ? '#fee2e2' : status.includes('✅') ? '#dcfce7' : '#dbeafe', border: `1px solid ${status.includes('❌') ? '#dc2626' : status.includes('✅') ? '#16a34a' : '#3b82f6'}`, borderRadius: 6, fontSize: 14, color: status.includes('❌') ? '#991b1b' : status.includes('✅') ? '#15803d' : '#1e40af', fontWeight: 500 }}>{status}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: 32, alignItems: 'flex-start' }}>
        
        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>Basic Information</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Artist</label><input style={inputStyle} value={entry.artist || ''} onChange={e => handleChange('artist', e.target.value)} placeholder="Enter artist name" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Title</label><input style={inputStyle} value={entry.title || ''} onChange={e => handleChange('title', e.target.value)} placeholder="Enter album title" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>This Release Year</label><input style={inputStyle} value={entry.year || ''} onChange={e => { handleChange('year', e.target.value); if (!entry.master_release_date) { const decade = calculateDecade(e.target.value); if (decade) handleChange('decade', decade); }}} placeholder="e.g. 1969" /><div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Year of this pressing</div></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Master Release Year</label><input style={inputStyle} value={entry.master_release_date || ''} onChange={e => { handleChange('master_release_date', e.target.value); const decade = calculateDecade(e.target.value); if (decade) handleChange('decade', decade); }} placeholder="e.g. 1967" /><div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Original first release</div></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Folder</label><input style={inputStyle} value={entry.folder || ''} onChange={e => handleChange('folder', e.target.value)} placeholder="Collection folder" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Format</label><input style={inputStyle} value={entry.format || ''} onChange={e => handleChange('format', e.target.value)} placeholder="e.g. Vinyl, LP" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Media Condition</label><input style={inputStyle} value={entry.media_condition || ''} onChange={e => handleChange('media_condition', e.target.value)} placeholder="e.g. VG+, NM" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>💰 Sell Price</label><input style={inputStyle} value={entry.sell_price || ''} onChange={e => handleChange('sell_price', e.target.value)} placeholder="e.g. $25.00" /></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Image URL</label><input style={inputStyle} value={entry.image_url || ''} onChange={e => handleChange('image_url', e.target.value)} placeholder="Cover image URL" />{entry.image_url && <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, display: 'flex', justifyContent: 'center', marginTop: 12 }}><Image src={entry.image_url} alt="cover" width={120} height={120} style={{ borderRadius: 8, objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} unoptimized /></div>}</div>
          </div>
        </div>

        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>🎵 Streaming</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 16, background: '#dcfce7', border: '1px solid #16a34a', borderRadius: 8 }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#15803d' }}>Spotify</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#15803d" }}>Spotify ID {!entry.spotify_id && '⚠️'}</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.spotify_id || ''} onChange={e => handleChange('spotify_id', e.target.value)} placeholder="e.g. 4aawyAB9vmqN3uQ7FjRGTy" /></div>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#15803d" }}>URL</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.spotify_url || ''} onChange={e => handleChange('spotify_url', e.target.value)} placeholder="https://open.spotify.com/album/..." /></div>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#15803d" }}>Genres</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.spotify_genres?.join(', ') || ''} onChange={e => handleChange('spotify_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="classic rock" /></div>
              </div>
            </div>
            <div style={{ padding: 16, background: '#fce7f3', border: '1px solid #ec4899', borderRadius: 8 }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#be185d' }}>Apple Music</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#be185d" }}>Apple ID {!entry.apple_music_id && '⚠️'}</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.apple_music_id || ''} onChange={e => handleChange('apple_music_id', e.target.value)} placeholder="e.g. 1440857781" /></div>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#be185d" }}>URL</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.apple_music_url || ''} onChange={e => handleChange('apple_music_url', e.target.value)} placeholder="https://music.apple.com/..." /></div>
                <div><label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '500', color: "#be185d" }}>Genres</label><input style={{...inputStyle, fontSize: '13px'}} value={entry.apple_music_genres?.join(', ') || ''} onChange={e => handleChange('apple_music_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Rock, Psychedelic" /></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>Metadata</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Genres {!entry.discogs_genres || entry.discogs_genres.length === 0 ? '⚠️' : '✓'}</label><input style={inputStyle} value={entry.discogs_genres?.join(', ') || ''} onChange={e => handleChange('discogs_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Rock, Jazz" /><div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Comma-separated</div></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Styles {!entry.discogs_styles || entry.discogs_styles.length === 0 ? '⚠️' : '✓'}</label><input style={inputStyle} value={entry.discogs_styles?.join(', ') || ''} onChange={e => handleChange('discogs_styles', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="Progressive Rock" /><div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Comma-separated</div></div>
            <div><label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Decade {!entry.decade ? '⚠️' : '✓'}</label><input style={inputStyle} value={entry.decade || ''} onChange={e => handleChange('decade', parseInt(e.target.value) || null)} placeholder="1970" type="number" step="10" /><div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Auto-calculated</div></div>
            <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #0369a1' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#0c4a6e' }}>🏆 Badges</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!entry.steves_top_200} onChange={e => handleChange('steves_top_200', e.target.checked)} style={{ marginRight: 8 }} /><span style={{ fontWeight: '600', color: '#dc2626' }}>⭐ Top 200</span></label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!entry.this_weeks_top_10} onChange={e => handleChange('this_weeks_top_10', e.target.checked)} style={{ marginRight: 8 }} /><span style={{ fontWeight: '600', color: '#ea580c' }}>🔥 Top 10</span></label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!entry.inner_circle_preferred} onChange={e => handleChange('inner_circle_preferred', e.target.checked)} style={{ marginRight: 8 }} /><span style={{ fontWeight: '600', color: '#7c3aed' }}>💎 Inner Circle</span></label>
              </div>
            </div>
            <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, border: '1px solid #f59e0b' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 12px 0', color: '#92400e' }}>Blocking</h4>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}><input type="checkbox" checked={!!entry.blocked} onChange={e => handleChange('blocked', e.target.checked)} style={{ marginRight: 8 }} /><strong>Block Album</strong></label>
              {sides.length > 0 && <div><div style={{ fontWeight: '600', marginBottom: 8 }}>Block Sides:</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{sides.map(side => <label key={side} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: blockedSides.includes(side) ? '#fee2e2' : '#fff', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}><input type="checkbox" checked={blockedSides.includes(side)} onChange={() => handleBlockSide(side)} style={{ marginRight: 6 }} />Side {side}</label>)}</div></div>}
            </div>
          </div>
        </div>

        <div style={{ color: "#222" }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 16, color: '#374151' }}>Tracklist {!tracks || tracks.length === 0 ? '⚠️' : '✓'}</h3>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Pos</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Time</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Lyrics</th>
                  <th style={{ padding: '12px 8px', width: 40, borderBottom: '1px solid #e5e7eb' }}></th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((t, i) => (
                  <tr key={i} style={{ borderBottom: i < tracks.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '8px' }}><input value={t.position} onChange={e => handleTrackChange(i, 'position', e.target.value)} style={{ ...inputStyle, width: 50, padding: '4px 6px', fontSize: '12px', textAlign: 'center' }} placeholder="A1" /></td>
                    <td style={{ padding: '8px' }}><input value={t.title} onChange={e => handleTrackChange(i, 'title', e.target.value)} style={{ ...inputStyle, padding: '4px 6px', fontSize: '12px' }} placeholder="Track title" /></td>
                    <td style={{ padding: '8px' }}><input value={t.duration} onChange={e => handleTrackChange(i, 'duration', e.target.value)} style={{ ...inputStyle, width: 70, padding: '4px 6px', fontSize: '12px', textAlign: 'center' }} placeholder="3:45" /></td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {t.lyrics && t.lyrics_source === 'apple_music' && <span style={{ fontSize: 16 }} title="Has Apple lyrics">🍎</span>}
                      {t.lyrics_url && <a href={t.lyrics_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, textDecoration: 'none', marginLeft: t.lyrics ? 4 : 0 }} title="Genius">📝</a>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}><button type="button" onClick={() => removeTrack(i)} style={{ color: "#dc2626", background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: '4px', borderRadius: '4px' }} title="Remove">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addTrack} style={{ ...buttonStyle, marginTop: 12, width: '100%', background: '#f0f9ff', color: '#0369a1', border: '1px solid #0369a1' }}>+ Add Track</button>
        </div>
      </div>

      {/* SALE SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        border: '2px solid #10b981',
        borderRadius: 12,
        padding: 24,
        marginTop: 32
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}>
          <div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: 'white',
              margin: '0 0 4px 0'
            }}>
              💰 Merchandise / Sale Information
            </h3>
            <p style={{
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0
            }}>
              List this item for sale on various platforms
            </p>
          </div>
          
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '12px 20px',
            borderRadius: 8,
            color: 'white',
            fontWeight: 600,
            fontSize: 16
          }}>
            <input
              type="checkbox"
              checked={forSale}
              onChange={e => setForSale(e.target.checked)}
              style={{
                transform: 'scale(1.5)',
                accentColor: 'white'
              }}
            />
            Mark for Sale
          </label>
        </div>

        {forSale && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 8,
            padding: 20
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 16
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Sale Price (USD) *
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Platform
                </label>
                <select
                  value={salePlatform}
                  onChange={e => setSalePlatform(e.target.value)}
                  style={{
                    ...inputStyle,
                    backgroundColor: 'white',
                    color: '#1f2937'
                  }}
                >
                  <option value="">Select platform...</option>
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6
                }}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={saleQuantity}
                  onChange={e => setSaleQuantity(e.target.value)}
                  min="1"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 6
              }}>
                Sale Notes (Optional)
              </label>
              <textarea
                value={saleNotes}
                onChange={e => setSaleNotes(e.target.value)}
                placeholder="Condition details, special information, etc..."
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{
              marginTop: 12,
              padding: 12,
              background: '#dbeafe',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              fontSize: 13,
              color: '#1e40af'
            }}>
              💡 <strong>Tip:</strong> This item will appear in the <a href="/admin/sale-items" style={{ color: '#1e40af', fontWeight: 600 }}>Sale Items</a> management page
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...buttonStyle, padding: '12px 24px', fontSize: '14px', background: saving ? '#9ca3af' : '#2563eb', color: 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button onClick={() => router.push('/admin/edit-collection')} style={{ ...buttonStyle, padding: '12px 24px', fontSize: '14px', background: '#f3f4f6', color: '#374151' }}>Back</button>
        </div>
      </div>
    </div>
  );
}