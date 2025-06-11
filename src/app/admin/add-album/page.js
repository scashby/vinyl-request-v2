// Admin Add Album page ("/admin/add-album")
// Allows admin to add a new album manually, including Discogs lookup and Supabase submission.

import { useState } from 'react';
import { supabase } from 'lib/supabaseClient'

async function fetchDiscogsRelease(releaseId) {
  const res = await fetch(`/api/discogsProxy?releaseId=${releaseId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function Page() {
  const [form, setForm] = useState({
    artist: '', title: '', year: '', folder: '', format: '',
    discogs_release_id: '', image_url: '', media_condition: ''
  });
  const [status, setStatus] = useState('');

  async function lookupDiscogs() {
    setStatus('Looking up...');
    try {
      const discogs = await fetchDiscogsRelease(form.discogs_release_id);
      setForm(f => ({
        ...f,
        artist: discogs.artists?.[0]?.name || f.artist,
        title: discogs.title || f.title,
        year: discogs.year?.toString() || f.year,
        format: discogs.formats?.[0]?.name || f.format,
        image_url: discogs.images?.[0]?.uri || f.image_url
      }));
      setStatus('Discogs data loaded.');
    } catch {
      setStatus('Discogs lookup failed.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('Adding...');
    const { error } = await supabase.from('collection').insert([{ ...form }]);
    setStatus(error ? `Error: ${error.message}` : 'Album added!');
    if (!error) setForm({ artist: '', title: '', year: '', folder: '', format: '', discogs_release_id: '', image_url: '', media_condition: '' });
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Add Album Manually</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Discogs Release ID:</label>
          <input value={form.discogs_release_id} onChange={e => setForm(f => ({ ...f, discogs_release_id: e.target.value }))} />
          <button type="button" onClick={lookupDiscogs}>Lookup</button>
        </div>
        <div>
          <label>Artist:</label>
          <input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} />
        </div>
        <div>
          <label>Title:</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label>Year:</label>
          <input value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
        </div>
        <div>
          <label>Folder:</label>
          <input value={form.folder} onChange={e => setForm(f => ({ ...f, folder: e.target.value }))} />
        </div>
        <div>
          <label>Format:</label>
          <input value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} />
        </div>
        <div>
          <label>Image URL:</label>
          <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
        </div>
        <div>
          <label>Media Condition:</label>
          <input value={form.media_condition} onChange={e => setForm(f => ({ ...f, media_condition: e.target.value }))} />
        </div>
        <button type="submit">Add Album</button>
      </form>
      <p>{status}</p>
    </div>
  );
}
