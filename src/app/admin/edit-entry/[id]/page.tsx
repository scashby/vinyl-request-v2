// Enhanced Admin Edit Entry page with sell price support
// Update for: src/app/admin/edit-entry/[id]/page.tsx

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient'
import Image from 'next/image';

type Track = { position: string; title: string; duration: string };

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
  [key: string]: unknown;
};

type DiscogsData = {
  year?: string | number;
  images?: { uri: string }[];
  tracklist?: { position?: string; title?: string; duration?: string }[];
  [key: string]: unknown;
};

async function fetchDiscogsField(
  releaseId: string,
  field: string
) {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error('Discogs fetch failed');
  const data: DiscogsData = await res.json();
  switch (field) {
    case 'year': return data.year ? String(data.year) : '';
    case 'image_url': return data.images?.[0]?.uri || '';
    case 'tracklists': return JSON.stringify(data.tracklist || []);
    default: return '';
  }
}

function cleanTrack(track: Partial<Track>): Track {
  return {
    position: track.position || '',
    title: track.title || '',
    duration: track.duration || '',
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

  useEffect(() => {
    fetchEntry(id).then((data) => {
      console.log('Fetched entry data:', data);
      console.log('sell_price value:', data?.sell_price);
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

  async function fetchDiscogs(field: string) {
    setStatus(`Fetching ${field} from Discogs...`);
    try {
      const val = await fetchDiscogsField(entry!.discogs_release_id, field);
      if (field === "tracklists") {
        let arr: unknown[] = [];
        try { arr = JSON.parse(val as string); } catch { arr = []; }
        setTracks(Array.isArray(arr) ? (arr as Partial<Track>[]).map(cleanTrack) : []);
        handleChange('tracklists', val);
      } else {
        handleChange(field, val);
      }
      setStatus(`Updated ${field} from Discogs`);
    } catch {
      setStatus(`Failed to fetch ${field} from Discogs`);
    }
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
    };
    
    console.log('Saving entry with badges:', {
      steves_top_200: update.steves_top_200,
      this_weeks_top_10: update.this_weeks_top_10,
      inner_circle_preferred: update.inner_circle_preferred
    });
    
    const { error } = await supabase.from('collection').update(update).eq('id', entry.id);
    
    if (error) {
      console.error('Supabase error:', error);
      setStatus(`Error: ${error.message}`);
      setSaving(false);
    } else {
      setStatus('Saved successfully!');
      setSaving(false);
      setTimeout(() => {
        router.push('/admin/edit-collection');
      }, 1000);
    }
  }

  // For blocking sides (gather all unique sides)
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
      maxWidth: 900, 
      margin: '32px auto', 
      padding: 32, 
      background: '#fff', 
      borderRadius: 12, 
      color: "#222",
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ color: "#222", margin: 0, fontSize: '24px', fontWeight: '600' }}>
          Edit Entry #{entry.id}
        </h2>
        <p style={{ color: "#6b7280", margin: '8px 0 0 0', fontSize: '14px' }}>
          {entry.artist} - {entry.title}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32, alignItems: 'flex-start' }}>
        
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
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Year</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  style={{...inputStyle, flex: 1}}
                  value={entry.year || ''} 
                  onChange={e => handleChange('year', e.target.value)}
                  placeholder="e.g. 1969" 
                />
                <button 
                  type="button" 
                  style={buttonStyle} 
                  onClick={() => fetchDiscogs('year')}
                  title="Fetch from Discogs"
                >
                  Discogs
                </button>
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

            {/* Sell Price Field */}
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>
                💰 Sell Price
              </label>
              <input 
                style={inputStyle}
                value={entry.sell_price || ''} 
                onChange={e => {
                  console.log('Updating sell_price to:', e.target.value);
                  handleChange('sell_price', e.target.value);
                }}
                placeholder="e.g. $25.00 or NFS"
              />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
                Enter price like &quot;$25.00&quot; or &quot;NFS&quot; for not for sale. Leave blank if not selling.
              </div>
              {entry.sell_price && (
                <div style={{ fontSize: '12px', color: '#059669', marginTop: 4, fontWeight: 'bold' }}>
                  Current price: {entry.sell_price}
                </div>
              )}
            </div>

            {/* Badge Options */}
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
              
              <div style={{ fontSize: '12px', color: '#0369a1', marginTop: 8 }}>
                These badges will appear on the browse page and TV display
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: '500', color: "#374151" }}>Image URL</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input 
                  style={{...inputStyle, flex: 1}}
                  value={entry.image_url || ''} 
                  onChange={e => handleChange('image_url', e.target.value)}
                  placeholder="Cover image URL" 
                />
                <button 
                  type="button" 
                  style={buttonStyle} 
                  onClick={() => fetchDiscogs('image_url')}
                  title="Fetch from Discogs"
                >
                  Discogs
                </button>
              </div>
              {entry.image_url && (
                <div style={{ 
                  padding: 12, 
                  background: '#f9fafb', 
                  borderRadius: 8, 
                  display: 'flex', 
                  justifyContent: 'center' 
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

        {/* Right Column - Tracklist & Blocking */}
        <div style={{ color: "#222" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#374151' }}>
                Tracklist
              </h3>
              <button 
                type="button" 
                style={buttonStyle} 
                onClick={() => fetchDiscogs('tracklists')}
              >
                Fetch from Discogs
              </button>
            </div>
            
            <div style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: 8, 
              overflow: 'hidden',
              maxHeight: 400,
              overflowY: 'auto'
            }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Pos</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Title</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', borderBottom: '1px solid #e5e7eb' }}>Duration</th>
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

          {/* Blocking Section */}
          <div style={{ 
            padding: 20, 
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
            color: status.includes('Error') ? '#dc2626' : status.includes('success') ? '#059669' : '#374151',
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