// Admin Edit Entry page ("/admin/edit-entry/[id]")
// Allows admin to edit all fields of a collection entry by ID; supports Discogs lookup and blocked sides.

"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from 'lib/supabaseClient';
import Image from 'next/image';

async function fetchDiscogsField(releaseId, field) {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error('Discogs fetch failed');
  const data = await res.json();
  switch (field) {
    case 'year': return data.year ? data.year.toString() : '';
    case 'image_url': return data.images?.[0]?.uri || '';
    case 'tracklists': return JSON.stringify(data.tracklist || []);
    default: return '';
  }
}

function cleanTrack(track) {
  return {
    position: track.position || '',
    title: track.title || '',
    duration: track.duration || '',
  };
}

export default function Page() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState('');
  const [blockedSides, setBlockedSides] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tracks, setTracks] = useState([]);

  useEffect(() => {
    fetchEntry(id).then(data => {
      setEntry(data);
      setBlockedSides(Array.isArray(data?.blocked_sides) ? data.blocked_sides : []);
      let tl = [];
      if (data?.tracklists) {
        try { tl = JSON.parse(data.tracklists); } catch { tl = []; }
      }
      setTracks(Array.isArray(tl) ? tl.map(cleanTrack) : []);
    });
  }, [id]);

  async function fetchEntry(rowId) {
    const { data } = await supabase.from('collection').select('*').eq('id', rowId).single();
    return data;
  }

  if (!entry) return <div style={{ color: "#222" }}>Loading...</div>;

  function handleChange(field, value) {
    setEntry(e => ({ ...e, [field]: value }));
  }

  function handleBlockSide(side) {
    setBlockedSides(bs =>
      bs.includes(side) ? bs.filter(s => s !== side) : [...bs, side]
    );
  }

  async function fetchDiscogs(field) {
    setStatus(`Fetching ${field} from Discogs...`);
    try {
      const val = await fetchDiscogsField(entry.discogs_release_id, field);
      if (field === "tracklists") {
        let arr = [];
        try { arr = JSON.parse(val); } catch { arr = []; }
        setTracks(Array.isArray(arr) ? arr.map(cleanTrack) : []);
        handleChange('tracklists', val);
      } else {
        handleChange(field, val);
      }
      setStatus(`Updated ${field} from Discogs.`);
    } catch {
      setStatus(`Failed to fetch ${field} from Discogs.`);
    }
  }

  function handleTrackChange(i, key, value) {
    setTracks(tks => tks.map((t, j) => j === i ? { ...t, [key]: value } : t));
  }

  function addTrack() {
    setTracks(tks => [...tks, { position: '', title: '', duration: '' }]);
  }
  function removeTrack(i) {
    setTracks(tks => tks.filter((_, j) => j !== i));
  }

  async function handleSave() {
    setSaving(true);
    const update = {
      ...entry,
      blocked_sides: blockedSides,
      blocked: !!entry.blocked,
      tracklists: JSON.stringify(tracks),
    };
    const { error } = await supabase.from('collection').update(update).eq('id', entry.id);
    setStatus(error ? `Error: ${error.message}` : 'Saved!');
    setSaving(false);
    if (!error) setTimeout(() => router.push('/admin/collection'), 900);
  }

  // For blocking sides (gather all unique sides)
  const sides = Array.from(
    new Set(tracks.map(t => t.position?.[0]).filter(Boolean))
  );

  return (
    <div style={{ maxWidth: 750, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 8, color: "#222" }}>
      <h2 style={{ color: "#222" }}>Edit Entry #{entry.id}</h2>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: 2, color: "#222" }}>
          <div>
            <label style={{ color: "#222" }}>Artist:</label>
            <input value={entry.artist || ''} onChange={e => handleChange('artist', e.target.value)} />
          </div>
          <div>
            <label style={{ color: "#222" }}>Title:</label>
            <input value={entry.title || ''} onChange={e => handleChange('title', e.target.value)} />
          </div>
          <div>
            <label style={{ color: "#222" }}>Year:</label>
            <input value={entry.year || ''} onChange={e => handleChange('year', e.target.value)} />
            <button type="button" style={{ marginLeft: 8 }} onClick={() => fetchDiscogs('year')}>Fetch from Discogs</button>
          </div>
          <div>
            <label style={{ color: "#222" }}>Folder:</label>
            <input value={entry.folder || ''} onChange={e => handleChange('folder', e.target.value)} />
          </div>
          <div>
            <label style={{ color: "#222" }}>Format:</label>
            <input value={entry.format || ''} onChange={e => handleChange('format', e.target.value)} />
          </div>
          <div>
            <label style={{ color: "#222" }}>Image URL:</label>
            <input value={entry.image_url || ''} onChange={e => handleChange('image_url', e.target.value)} />
            <button type="button" style={{ marginLeft: 8 }} onClick={() => fetchDiscogs('image_url')}>Fetch from Discogs</button>
            <div style={{ margin: '6px 0' }}>
              {entry.image_url && (
                <Image
                  src={entry.image_url}
                  alt="cover"
                  width={80}
                  height={80}
                  style={{ borderRadius: 4, objectFit: 'cover' }}
                  unoptimized // Remove this if you add the domain to next.config.js
                />
              )}
            </div>
          </div>
          <div>
            <label style={{ color: "#222" }}>Media Condition:</label>
            <input value={entry.media_condition || ''} onChange={e => handleChange('media_condition', e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 3, color: "#222" }}>
          <div>
            <label style={{ color: "#222", fontWeight: 600 }}>Tracklists:</label>
            <button type="button" style={{ marginLeft: 8 }} onClick={() => fetchDiscogs('tracklists')}>Fetch from Discogs</button>
            <table style={{ width: '100%', fontSize: 13, marginTop: 6, color: "#222" }}>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Title</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((t, i) => (
                  <tr key={i}>
                    <td><input value={t.position} onChange={e => handleTrackChange(i, 'position', e.target.value)} style={{ width: 44 }} /></td>
                    <td><input value={t.title} onChange={e => handleTrackChange(i, 'title', e.target.value)} style={{ width: 180 }} /></td>
                    <td><input value={t.duration} onChange={e => handleTrackChange(i, 'duration', e.target.value)} style={{ width: 60 }} /></td>
                    <td>
                      <button type="button" onClick={() => removeTrack(i)} style={{ color: "#c00", fontWeight: 600, border: 0, background: "none", fontSize: 16 }}>&times;</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addTrack} style={{ marginTop: 8 }}>Add Track</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong style={{ color: "#222" }}>Block:</strong>
            <label style={{ marginLeft: 10, color: "#222" }}>
              <input
                type="checkbox"
                checked={!!entry.blocked}
                onChange={e => handleChange('blocked', e.target.checked)}
              />{' '}
              Block Album
            </label>
            {sides.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ color: "#222" }}>Block Sides:</strong>
                {sides.map(side => (
                  <label key={side} style={{ marginLeft: 12, color: "#222" }}>
                    <input
                      type="checkbox"
                      checked={blockedSides.includes(side)}
                      onChange={() => handleBlockSide(side)}
                    />{' '}
                    {side}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <button onClick={handleSave} disabled={saving} style={{ marginRight: 8 }}>Save</button>
        <button onClick={() => router.push('/admin/collection')}>Cancel</button>
        <span style={{ marginLeft: 16, color: '#222' }}>{status}</span>
      </div>
    </div>
  );
}
