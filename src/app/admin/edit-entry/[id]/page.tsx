// src/app/admin/edit-entry/[id]/page.tsx - WITH TRACKLIST MANAGEMENT TOOLS
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import Image from 'next/image';
import GenreStyleSelector from 'components/GenreStyleSelector';

type Track = { 
  position: string; 
  title: string; 
  duration: string;
  artist?: string;
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
  blocked_tracks: Array<{ position: string; reason: string }> | null;
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
  tracklist?: { position?: string; title?: string; duration?: string; artists?: Array<{ name: string }> }[];
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
    artist: track.artist || undefined,
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
  const [activeTab, setActiveTab] = useState<'basic' | 'streaming' | 'metadata' | 'tracklist' | 'sale'>('basic');
  
  const [fetchingDiscogs, setFetchingDiscogs] = useState(false);
  const [enrichingSpotify, setEnrichingSpotify] = useState(false);
  const [enrichingAppleMusic, setEnrichingAppleMusic] = useState(false);
  const [enrichingGenius, setEnrichingGenius] = useState(false);
  const [fetchingAppleLyrics, setFetchingAppleLyrics] = useState(false);

  const [forSale, setForSale] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [salePlatform, setSalePlatform] = useState('');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [saleNotes, setSaleNotes] = useState('');

  // Tracklist management - no separate panel needed

  useEffect(() => {
    fetchEntry(id).then((data) => {
      setEntry(data);
      setBlockedSides(Array.isArray(data?.blocked_sides) ? data.blocked_sides : []);
      let tl: unknown[] = [];
      if (data?.tracklists) {
        try { tl = JSON.parse(data.tracklists); } catch { tl = []; }
      }
      setTracks(Array.isArray(tl) ? (tl as Partial<Track>[]).map(cleanTrack) : []);
      
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
          const newTracks = data.tracklist.map(track => {
            let trackArtist = undefined;
            if (track.artists && track.artists.length > 0) {
              trackArtist = track.artists.map(a => a.name).join(', ');
            }
            return cleanTrack({
              position: track.position,
              title: track.title,
              duration: track.duration,
              artist: trackArtist
            });
          });
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

  // TRACKLIST MANAGEMENT FUNCTIONS
  function moveTrackUp(index: number) {
    if (index === 0) return;
    const newTracks = [...tracks];
    [newTracks[index - 1], newTracks[index]] = [newTracks[index], newTracks[index - 1]];
    setTracks(newTracks);
  }

  function moveTrackDown(index: number) {
    if (index === tracks.length - 1) return;
    const newTracks = [...tracks];
    [newTracks[index], newTracks[index + 1]] = [newTracks[index + 1], newTracks[index]];
    setTracks(newTracks);
  }

  function moveTrackToSide(trackIndex: number, newSide: string) {
    const newTracks = [...tracks];
    const track = newTracks[trackIndex];
    
    // Get the highest track number on the target side
    const targetSideTracks = tracks.filter(t => t.position?.startsWith(newSide));
    const maxNumber = targetSideTracks.length > 0
      ? Math.max(...targetSideTracks.map(t => {
          const match = t.position.match(/\d+$/);
          return match ? parseInt(match[0]) : 0;
        }))
      : 0;
    
    // Assign new position
    newTracks[trackIndex] = {
      ...track,
      position: `${newSide}${maxNumber + 1}`
    };
    
    setTracks(newTracks);
    setStatus(`✅ Moved track to Side ${newSide}`);
  }

  function mergeSide(fromSide: string, toSide: string) {
    if (fromSide === toSide) return;
    
    const newTracks = tracks.map(track => {
      if (track.position?.startsWith(fromSide)) {
        const trackNumber = track.position.substring(1);
        return {
          ...track,
          position: `${toSide}${trackNumber}`
        };
      }
      return track;
    });
    
    setTracks(newTracks);
    setStatus(`✅ Merged Side ${fromSide} into Side ${toSide}`);
  }

  function deleteSide(sideToDelete: string) {
    if (!confirm(`Delete all tracks from Side ${sideToDelete}?`)) return;
    
    const newTracks = tracks.filter(track => !track.position?.startsWith(sideToDelete));
    setTracks(newTracks);
    setStatus(`✅ Deleted Side ${sideToDelete}`);
  }

  function addNewSide() {
    // Find the next available side letter/number
    const existingSides = Array.from(new Set(tracks.map(t => t.position?.[0]).filter(Boolean)));
    const numericSides = existingSides.filter(s => /^\d+$/.test(s)).map(s => parseInt(s));
    const letterSides = existingSides.filter(s => /^[A-Z]$/i.test(s));
    
    let newSide: string;
    if (numericSides.length > 0) {
      // If we have numeric sides, add the next number
      newSide = String(Math.max(...numericSides) + 1);
    } else if (letterSides.length > 0) {
      // If we have letter sides, add the next letter
      const lastLetter = letterSides.sort().pop() || 'A';
      newSide = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
    } else {
      // First side
      newSide = '1';
    }
    
    // Add a placeholder track to the new side
    const newTrack: Track = {
      position: `${newSide}1`,
      title: '',
      duration: '',
      artist: undefined
    };
    
    setTracks([...tracks, newTrack]);
    setStatus(`✅ Added Side ${newSide}`);
  }

  if (!entry) {
    return <div style={{ maxWidth: 1200, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 8, color: "#222", textAlign: 'center' }}>Loading...</div>;
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
    setTracks((tks) => [...tks, { position: '', title: '', duration: '', artist: undefined }]);
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
      blocked_tracks: entry.blocked_tracks || [],
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
  
  // Group tracks by side
  const tracksBySide = tracks.reduce((acc, track) => {
    const side = track.position?.[0] || 'Unknown';
    if (!acc[side]) acc[side] = [];
    acc[side].push(track);
    return acc;
  }, {} as Record<string, Track[]>);

  const inputStyle = { 
    padding: '10px 12px', 
    border: '1px solid #d1d5db', 
    borderRadius: '6px', 
    fontSize: '14px', 
    width: '100%', 
    boxSizing: 'border-box' as const
  };
  
  const buttonStyle = { 
    padding: '8px 16px', 
    fontSize: '14px', 
    border: 'none', 
    borderRadius: '6px', 
    fontWeight: '600', 
    cursor: 'pointer', 
    transition: 'all 0.2s' 
  };

  const tabStyle = (isActive: boolean) => ({
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
    background: isActive ? '#eff6ff' : 'transparent',
    color: isActive ? '#2563eb' : '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ maxWidth: 1200, margin: '20px auto', padding: 20, background: '#fff', borderRadius: 10, color: "#222", boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: "#111", margin: 0, fontSize: '22px', fontWeight: '700' }}>Edit Entry #{entry.id}</h2>
            <p style={{ color: "#6b7280", margin: '6px 0 0 0', fontSize: '14px' }}>{entry.artist} - {entry.title}</p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasMissingDiscogs && (
              <button onClick={fetchDiscogsMetadata} disabled={fetchingDiscogs} style={{ ...buttonStyle, background: fetchingDiscogs ? '#9ca3af' : '#f59e0b', color: 'white' }}>
                {fetchingDiscogs ? '⏳ Fetching...' : '🔄 Fetch Discogs'}
              </button>
            )}
            {missingSpotify && (
              <button onClick={enrichSpotify} disabled={enrichingSpotify} style={{ ...buttonStyle, background: enrichingSpotify ? '#9ca3af' : '#1DB954', color: 'white' }}>
                {enrichingSpotify ? '⏳ Searching...' : '🎵 Add Spotify'}
              </button>
            )}
            {missingAppleMusic && (
              <button onClick={enrichAppleMusic} disabled={enrichingAppleMusic} style={{ ...buttonStyle, background: enrichingAppleMusic ? '#9ca3af' : '#FA57C1', color: 'white' }}>
                {enrichingAppleMusic ? '⏳ Searching...' : '🍎 Add Apple'}
              </button>
            )}
            {canFetchGenius && (
              <button onClick={enrichGenius} disabled={enrichingGenius} style={{ ...buttonStyle, background: enrichingGenius ? '#9ca3af' : '#7c3aed', color: 'white' }}>
                {enrichingGenius ? '⏳ Searching...' : '📝 Add Genius'}
              </button>
            )}
            {canFetchAppleLyrics && !hasAppleLyrics && (
              <button onClick={fetchAppleMusicLyrics} disabled={fetchingAppleLyrics} style={{ ...buttonStyle, background: fetchingAppleLyrics ? '#9ca3af' : '#ec4899', color: 'white' }}>
                {fetchingAppleLyrics ? '⏳ Fetching...' : '🍎 Fetch Lyrics'}
              </button>
            )}
          </div>
        </div>

        {/* Connected Services */}
        {(entry.spotify_id || entry.apple_music_id || hasAppleLyrics) && (
          <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#15803d' }}>✅ Connected:</span>
            {entry.spotify_id && <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: 4, fontWeight: 600 }}>🎵 Spotify</span>}
            {entry.apple_music_id && <span style={{ padding: '4px 10px', background: '#fce7f3', color: '#be185d', borderRadius: 4, fontWeight: 600 }}>🍎 Apple Music</span>}
            {hasAppleLyrics && <span style={{ padding: '4px 10px', background: '#fce7f3', color: '#be185d', borderRadius: 4, fontWeight: 600 }}>📝 {appleLyricsCount} lyrics</span>}
            {geniusLyricsCount > 0 && <span style={{ padding: '4px 10px', background: '#e9d5ff', color: '#7c3aed', borderRadius: 4, fontWeight: 600 }}>🔗 {geniusLyricsCount} Genius</span>}
          </div>
        )}

        {/* Status Message */}
        {status && (
          <div style={{ 
            marginTop: 12, 
            padding: 10, 
            background: status.includes('❌') ? '#fee2e2' : status.includes('✅') ? '#dcfce7' : '#dbeafe', 
            border: `1px solid ${status.includes('❌') ? '#dc2626' : status.includes('✅') ? '#16a34a' : '#3b82f6'}`, 
            borderRadius: 6, 
            fontSize: 13, 
            color: status.includes('❌') ? '#991b1b' : status.includes('✅') ? '#15803d' : '#1e40af', 
            fontWeight: 600 
          }}>
            {status}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 20, display: 'flex', gap: 4, overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('basic')} style={tabStyle(activeTab === 'basic')}>
          📀 Basic Info
        </button>
        <button onClick={() => setActiveTab('streaming')} style={tabStyle(activeTab === 'streaming')}>
          🎵 Streaming
        </button>
        <button onClick={() => setActiveTab('metadata')} style={tabStyle(activeTab === 'metadata')}>
          🏷️ Metadata
        </button>
        <button onClick={() => setActiveTab('tracklist')} style={tabStyle(activeTab === 'tracklist')}>
          🎼 Tracklist {tracks.length > 0 && `(${tracks.length})`}
        </button>
        <button onClick={() => setActiveTab('sale')} style={tabStyle(activeTab === 'sale')}>
          💰 Sale Info
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {/* BASIC INFO TAB */}
        {activeTab === 'basic' && (
          <div style={{ display: 'grid', gridTemplateColumns: entry.image_url ? '2fr 1fr' : '1fr', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Artist *</label>
                <input style={inputStyle} value={entry.artist || ''} onChange={e => handleChange('artist', e.target.value)} placeholder="Enter artist name" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Title *</label>
                <input style={inputStyle} value={entry.title || ''} onChange={e => handleChange('title', e.target.value)} placeholder="Enter album title" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>This Release Year</label>
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
                    placeholder="1969" 
                  />
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Year of this pressing</div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Master Release Year</label>
                  <input 
                    style={inputStyle} 
                    value={entry.master_release_date || ''} 
                    onChange={e => { 
                      handleChange('master_release_date', e.target.value); 
                      const decade = calculateDecade(e.target.value); 
                      if (decade) handleChange('decade', decade); 
                    }} 
                    placeholder="1967" 
                  />
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Original first release</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Folder</label>
                  <input style={inputStyle} value={entry.folder || ''} onChange={e => handleChange('folder', e.target.value)} placeholder="Collection folder" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Format</label>
                  <input style={inputStyle} value={entry.format || ''} onChange={e => handleChange('format', e.target.value)} placeholder="Vinyl, LP" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Media Condition</label>
                  <input style={inputStyle} value={entry.media_condition || ''} onChange={e => handleChange('media_condition', e.target.value)} placeholder="VG+, NM" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>💰 Sell Price</label>
                  <input style={inputStyle} value={entry.sell_price || ''} onChange={e => handleChange('sell_price', e.target.value)} placeholder="$25.00" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>Cover Image URL</label>
                <input style={inputStyle} value={entry.image_url || ''} onChange={e => handleChange('image_url', e.target.value)} placeholder="Paste image URL" />
              </div>
            </div>
            {entry.image_url && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                <Image 
                  src={entry.image_url} 
                  alt="Album cover" 
                  width={300} 
                  height={300} 
                  style={{ borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: '100%', height: 'auto' }} 
                  unoptimized 
                />
              </div>
            )}
          </div>
        )}

        {/* STREAMING TAB */}
        {activeTab === 'streaming' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            {/* Spotify */}
            <div style={{ padding: 20, background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: '28px' }}>🎵</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#15803d' }}>Spotify</h3>
                {!entry.spotify_id && <span style={{ fontSize: '18px' }}>⚠️</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#15803d" }}>Spotify ID</label>
                  <input 
                    style={inputStyle} 
                    value={entry.spotify_id || ''} 
                    onChange={e => handleChange('spotify_id', e.target.value)} 
                    placeholder="e.g. 4aawyAB9vmqN3uQ7FjRGTy" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#15803d" }}>URL</label>
                  <input 
                    style={inputStyle} 
                    value={entry.spotify_url || ''} 
                    onChange={e => handleChange('spotify_url', e.target.value)} 
                    placeholder="https://open.spotify.com/album/..." 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#15803d" }}>Genres</label>
                  <input 
                    style={inputStyle} 
                    value={entry.spotify_genres?.join(', ') || ''} 
                    onChange={e => handleChange('spotify_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
                    placeholder="classic rock, psychedelic rock" 
                  />
                </div>
              </div>
            </div>

            {/* Apple Music */}
            <div style={{ padding: 20, background: '#fce7f3', border: '2px solid #ec4899', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ fontSize: '28px' }}>🍎</div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#be185d' }}>Apple Music</h3>
                {!entry.apple_music_id && <span style={{ fontSize: '18px' }}>⚠️</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#be185d" }}>Apple Music ID</label>
                  <input 
                    style={inputStyle} 
                    value={entry.apple_music_id || ''} 
                    onChange={e => handleChange('apple_music_id', e.target.value)} 
                    placeholder="e.g. 1440857781" 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#be185d" }}>URL</label>
                  <input 
                    style={inputStyle} 
                    value={entry.apple_music_url || ''} 
                    onChange={e => handleChange('apple_music_url', e.target.value)} 
                    placeholder="https://music.apple.com/..." 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: '600', color: "#be185d" }}>Genres</label>
                  <input 
                    style={inputStyle} 
                    value={entry.apple_music_genres?.join(', ') || ''} 
                    onChange={e => handleChange('apple_music_genres', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} 
                    placeholder="Rock, Psychedelic" 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* METADATA TAB */}
        {activeTab === 'metadata' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>
                  Genres {!entry.discogs_genres || entry.discogs_genres.length === 0 ? '⚠️' : '✅'}
                </label>
                <GenreStyleSelector
                  value={entry.discogs_genres || []}
                  onChange={(genres) => handleChange('discogs_genres', genres)}
                  type="genre"
                  placeholder="Select or add genres..."
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>
                  Styles {!entry.discogs_styles || entry.discogs_styles.length === 0 ? '⚠️' : '✅'}
                </label>
                <GenreStyleSelector
                  value={entry.discogs_styles || []}
                  onChange={(styles) => handleChange('discogs_styles', styles)}
                  type="style"
                  placeholder="Select or add styles..."
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: '600', color: "#374151", fontSize: '13px' }}>
                  Decade {!entry.decade ? '⚠️' : '✅'}
                </label>
                <input 
                  style={inputStyle} 
                  value={entry.decade || ''} 
                  onChange={e => handleChange('decade', parseInt(e.target.value) || null)} 
                  placeholder="1970" 
                  type="number" 
                  step="10" 
                />
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: 4 }}>Auto-calculated</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Badges */}
              <div style={{ padding: 16, background: '#f0f9ff', borderRadius: 10, border: '2px solid #0369a1' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 14px 0', color: '#0c4a6e' }}>🏆 Badges</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="checkbox" 
                      checked={!!entry.steves_top_200} 
                      onChange={e => handleChange('steves_top_200', e.target.checked)} 
                      style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }} 
                    />
                    <span style={{ fontWeight: '600', color: '#dc2626' }}>⭐ Top 200</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="checkbox" 
                      checked={!!entry.this_weeks_top_10} 
                      onChange={e => handleChange('this_weeks_top_10', e.target.checked)} 
                      style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }} 
                    />
                    <span style={{ fontWeight: '600', color: '#ea580c' }}>🔥 Top 10</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                    <input 
                      type="checkbox" 
                      checked={!!entry.inner_circle_preferred} 
                      onChange={e => handleChange('inner_circle_preferred', e.target.checked)} 
                      style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }} 
                    />
                    <span style={{ fontWeight: '600', color: '#7c3aed' }}>💎 Inner Circle</span>
                  </label>
                </div>
              </div>

              {/* Blocking */}
              <div style={{ padding: 16, background: '#fef3c7', borderRadius: 10, border: '2px solid #f59e0b' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 14px 0', color: '#92400e' }}>🚫 Blocking</h4>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: 14, cursor: 'pointer', fontSize: '14px' }}>
                  <input 
                    type="checkbox" 
                    checked={!!entry.blocked} 
                    onChange={e => handleChange('blocked', e.target.checked)} 
                    style={{ marginRight: 10, width: 18, height: 18, cursor: 'pointer' }} 
                  />
                  <strong>Block Entire Album</strong>
                </label>
                {sides.length > 0 && (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: 10, fontSize: '13px' }}>Block Individual Sides:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {sides.map(side => (
                        <label 
                          key={side} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            padding: '8px 12px', 
                            background: blockedSides.includes(side) ? '#fee2e2' : '#fff', 
                            border: '2px solid #d1d5db', 
                            borderRadius: '6px', 
                            cursor: 'pointer', 
                            fontSize: '13px',
                            fontWeight: '600'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={blockedSides.includes(side)} 
                            onChange={() => handleBlockSide(side)} 
                            style={{ marginRight: 8, width: 16, height: 16 }} 
                          />
                          Side {side}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Track-level blocking */}
                {tracks.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #fbbf24' }}>
                    <div style={{ fontWeight: '600', marginBottom: 10, fontSize: '13px' }}>
                      Block Individual Tracks:
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tracks.map((track, idx) => {
                        const blockedTracks = entry.blocked_tracks || [];
                        const blockedTrackData = blockedTracks.find(
                          (bt) => bt.position === track.position
                        );
                        const isBlocked = !!blockedTrackData;
                        
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              background: isBlocked ? '#fee2e2' : '#fff',
                              border: '1px solid #d1d5db',
                              borderRadius: 6
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isBlocked}
                              onChange={e => {
                                const blockedTracks = entry.blocked_tracks || [];
                                let newBlockedTracks: Array<{ position: string; reason: string }>;
                                
                                if (e.target.checked) {
                                  newBlockedTracks = [...blockedTracks, { position: track.position, reason: '' }];
                                } else {
                                  newBlockedTracks = blockedTracks.filter(
                                    bt => bt.position !== track.position
                                  );
                                }
                                handleChange('blocked_tracks', newBlockedTracks);
                              }}
                              style={{ width: 16, height: 16 }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', minWidth: 40 }}>
                              {track.position}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, color: '#1f2937' }}>
                              {track.title}
                            </span>
                            {isBlocked && (
                              <input
                                type="text"
                                value={blockedTrackData?.reason || ''}
                                onChange={e => {
                                  const blockedTracks = entry.blocked_tracks || [];
                                  const newBlockedTracks = blockedTracks.map(bt =>
                                    bt.position === track.position
                                      ? { ...bt, reason: e.target.value }
                                      : bt
                                  );
                                  handleChange('blocked_tracks', newBlockedTracks);
                                }}
                                placeholder="Reason (e.g., scratch at 2:30)"
                                style={{
                                  flex: 1,
                                  padding: '4px 8px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 4,
                                  fontSize: 12
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRACKLIST TAB */}
        {activeTab === 'tracklist' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#111' }}>
                {tracks.length === 0 ? '⚠️' : '✅'} {tracks.length} tracks
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {tracks.length > 0 && (
                  <button 
                    type="button" 
                    onClick={addNewSide} 
                    style={{ 
                      ...buttonStyle, 
                      background: '#7c3aed', 
                      color: 'white',
                      fontSize: '14px',
                      padding: '10px 18px'
                    }}
                  >
                    + Add New Side
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={addTrack} 
                  style={{ 
                    ...buttonStyle, 
                    background: '#2563eb', 
                    color: 'white',
                    fontSize: '14px',
                    padding: '10px 18px'
                  }}
                >
                  + Add Track
                </button>
              </div>
            </div>

            {tracks.length === 0 ? (
              <div style={{ 
                padding: 60, 
                textAlign: 'center', 
                background: '#f9fafb', 
                borderRadius: 10, 
                border: '2px dashed #d1d5db' 
              }}>
                <div style={{ fontSize: '48px', marginBottom: 12 }}>🎵</div>
                <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                  No tracks yet. Click &quot;Add Track&quot; or fetch from Discogs to get started.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {Object.entries(tracksBySide).map(([side, sideTracks]) => {
                  const hasMultipleSides = Object.keys(tracksBySide).length > 1;
                  const otherSides = Object.keys(tracksBySide).filter(s => s !== side);
                  
                  return (
                    <div key={side}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10, 
                        marginBottom: 12,
                        paddingBottom: 8,
                        borderBottom: '2px solid #e5e7eb'
                      }}>
                        <h4 style={{ 
                          fontSize: '16px', 
                          fontWeight: '700', 
                          margin: 0, 
                          color: '#374151',
                          background: '#f3f4f6',
                          padding: '6px 14px',
                          borderRadius: '6px'
                        }}>
                          Side {side}
                        </h4>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                          {sideTracks.length} {sideTracks.length === 1 ? 'track' : 'tracks'}
                        </span>
                        
                        {/* Side controls - only show if multiple sides exist */}
                        {hasMultipleSides && (
                          <>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                              <label style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                                Merge into:
                              </label>
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    mergeSide(side, e.target.value);
                                    e.target.value = ''; // Reset
                                  }
                                }}
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 4,
                                  fontSize: '13px',
                                  background: 'white',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="">Select side...</option>
                                {otherSides.map(targetSide => (
                                  <option key={targetSide} value={targetSide}>
                                    Side {targetSide}
                                  </option>
                                ))}
                              </select>
                              
                              <button
                                onClick={() => deleteSide(side)}
                                style={{
                                  ...buttonStyle,
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #dc2626',
                                  padding: '6px 12px',
                                  fontSize: '13px'
                                }}
                              >
                                🗑️ Delete Side
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {sideTracks.map((track) => {
                          const globalIdx = tracks.indexOf(track);
                          const hasMultipleSides = Object.keys(tracksBySide).length > 1;
                          const availableSides = Object.keys(tracksBySide);
                          
                          return (
                            <div 
                              key={globalIdx}
                              style={{ 
                                padding: 14, 
                                background: '#f9fafb', 
                                borderRadius: 8, 
                                border: '1px solid #e5e7eb',
                                display: 'grid',
                                gridTemplateColumns: hasMultipleSides 
                                  ? '50px 80px 120px 140px 1fr 100px 80px 40px'
                                  : '50px 80px 140px 1fr 100px 80px 40px',
                                gap: 12,
                                alignItems: 'center'
                              }}
                            >
                              {/* Move buttons */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                  onClick={() => moveTrackUp(globalIdx)}
                                  disabled={globalIdx === 0}
                                  style={{
                                    background: globalIdx === 0 ? '#f3f4f6' : '#e5e7eb',
                                    border: 'none',
                                    borderRadius: 3,
                                    cursor: globalIdx === 0 ? 'not-allowed' : 'pointer',
                                    fontSize: 14,
                                    padding: '2px 4px',
                                    color: globalIdx === 0 ? '#d1d5db' : '#374151'
                                  }}
                                  title="Move up"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => moveTrackDown(globalIdx)}
                                  disabled={globalIdx === tracks.length - 1}
                                  style={{
                                    background: globalIdx === tracks.length - 1 ? '#f3f4f6' : '#e5e7eb',
                                    border: 'none',
                                    borderRadius: 3,
                                    cursor: globalIdx === tracks.length - 1 ? 'not-allowed' : 'pointer',
                                    fontSize: 14,
                                    padding: '2px 4px',
                                    color: globalIdx === tracks.length - 1 ? '#d1d5db' : '#374151'
                                  }}
                                  title="Move down"
                                >
                                  ▼
                                </button>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                  Position
                                </label>
                                <input 
                                  value={track.position} 
                                  onChange={e => handleTrackChange(globalIdx, 'position', e.target.value)} 
                                  style={{ 
                                    ...inputStyle, 
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    padding: '8px'
                                  }} 
                                  placeholder="A1" 
                                />
                              </div>

                              {/* Move to Side dropdown - only show if multiple sides */}
                              {hasMultipleSides && (
                                <div>
                                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                    Move to
                                  </label>
                                  <select
                                    value={track.position?.[0] || ''}
                                    onChange={(e) => {
                                      if (e.target.value && e.target.value !== track.position?.[0]) {
                                        moveTrackToSide(globalIdx, e.target.value);
                                      }
                                    }}
                                    style={{
                                      ...inputStyle,
                                      padding: '8px',
                                      fontSize: '13px',
                                      background: 'white'
                                    }}
                                  >
                                    {availableSides.map(s => (
                                      <option key={s} value={s}>Side {s}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                  Track Artist
                                </label>
                                <input 
                                  value={track.artist || ''} 
                                  onChange={e => handleTrackChange(globalIdx, 'artist', e.target.value)} 
                                  style={{...inputStyle, padding: '8px', fontSize: '13px'}} 
                                  placeholder="Optional" 
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                  Track Title
                                </label>
                                <input 
                                  value={track.title} 
                                  onChange={e => handleTrackChange(globalIdx, 'title', e.target.value)} 
                                  style={{...inputStyle, padding: '8px', fontSize: '13px'}} 
                                  placeholder="Enter track title" 
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                  Duration
                                </label>
                                <input 
                                  value={track.duration} 
                                  onChange={e => handleTrackChange(globalIdx, 'duration', e.target.value)} 
                                  style={{ ...inputStyle, textAlign: 'center', padding: '8px', fontSize: '13px' }} 
                                  placeholder="3:45" 
                                />
                              </div>

                              <div style={{ textAlign: 'center' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                  Lyrics
                                </label>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', minHeight: 32 }}>
                                  {track.lyrics && track.lyrics_source === 'apple_music' && (
                                    <span style={{ fontSize: 20 }} title="Has Apple Music lyrics">🍎</span>
                                  )}
                                  {track.lyrics_url && (
                                    <a 
                                      href={track.lyrics_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      style={{ fontSize: 20, textDecoration: 'none' }} 
                                      title="View on Genius"
                                    >
                                      📝
                                    </a>
                                  )}
                                  {!track.lyrics && !track.lyrics_url && (
                                    <span style={{ fontSize: 16, color: '#d1d5db' }}>—</span>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100%' }}>
                                <button 
                                  type="button" 
                                  onClick={() => removeTrack(globalIdx)} 
                                  style={{ 
                                    color: "#dc2626", 
                                    background: '#fee2e2', 
                                    border: '1px solid #dc2626', 
                                    fontSize: 18, 
                                    cursor: 'pointer', 
                                    padding: '8px', 
                                    borderRadius: '6px',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                  }} 
                                  title="Remove track"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SALE TAB */}
        {activeTab === 'sale' && (
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 20,
              padding: 16,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: 10
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white', margin: '0 0 4px 0' }}>
                  💰 Merchandise / Sale Information
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', margin: 0 }}>
                  List this item for sale on various platforms
                </p>
              </div>
              
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '10px 16px',
                borderRadius: 8,
                color: 'white',
                fontWeight: 600,
                fontSize: 14
              }}>
                <input
                  type="checkbox"
                  checked={forSale}
                  onChange={e => setForSale(e.target.checked)}
                  style={{
                    transform: 'scale(1.3)',
                    cursor: 'pointer'
                  }}
                />
                Mark for Sale
              </label>
            </div>

            {forSale && (
              <div style={{
                background: '#f9fafb',
                borderRadius: 10,
                padding: 20,
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginBottom: 16
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 13,
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
                      fontSize: 13,
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
                      fontSize: 13,
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
                    fontSize: 13,
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
                    rows={4}
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
                  💡 <strong>Tip:</strong> This item will appear in the Sale Items management page
                </div>
              </div>
            )}

            {!forSale && (
              <div style={{ 
                padding: 40, 
                textAlign: 'center', 
                background: '#f9fafb', 
                borderRadius: 10, 
                border: '2px dashed #d1d5db' 
              }}>
                <div style={{ fontSize: '48px', marginBottom: 12 }}>💰</div>
                <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
                  Enable &quot;Mark for Sale&quot; to list this item on various platforms
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div style={{ 
        marginTop: 32, 
        paddingTop: 20, 
        borderTop: '2px solid #e5e7eb', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            style={{ 
              ...buttonStyle, 
              padding: '12px 24px', 
              fontSize: '15px', 
              background: saving ? '#9ca3af' : '#2563eb', 
              color: 'white', 
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '700'
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </button>
          <button 
            onClick={() => router.push('/admin/edit-collection')} 
            style={{ 
              ...buttonStyle, 
              padding: '12px 24px', 
              fontSize: '15px', 
              background: '#f3f4f6', 
              color: '#374151',
              border: '2px solid #d1d5db'
            }}
          >
            ← Back to Collection
          </button>
        </div>
      </div>
    </div>
  );
}