// Admin Metadata Enrichment page ("/admin/metadata-enrichment")
// Finds albums missing year/format/image and lets admin fetch from Discogs.

"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Page() {
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function fetchCollection() {
      const { data } = await supabase.from('collection').select('*');
      const incomplete = data.filter(
        a => !a.year || !a.format || !a.image_url
      );
      setAlbums(incomplete);
    }
    fetchCollection();
  }, []);

  const fetchMetadata = async (album) => {
    const query = encodeURIComponent(`${album.artist} ${album.title}`);
    const url = `https://api.discogs.com/database/search?q=${query}&type=release`;

    setStatus(`Fetching metadata for "${album.artist} – ${album.title}"...`);

    try {
      const res = await fetch(url);
      const json = await res.json();

      if (!json.results || json.results.length === 0) {
        setStatus('No match found');
        return;
      }

      const match = json.results[0];
      const updated = {
        year: match.year || album.year,
        format: match.format?.join(', ') || album.format,
        image_url: match.cover_image || album.image_url,
      };

      await supabase
        .from('collection')
        .update(updated)
        .eq('id', album.id);

      setStatus(`Updated metadata for "${album.artist} – ${album.title}"`);
      setAlbums(albums.filter(a => a.id !== album.id));
    } catch (err) {
      console.error(err);
      setStatus('Error fetching metadata');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Metadata Enrichment</h1>
      <p className="text-sm italic text-zinc-300 mb-2">
        Albums missing year, format, or image. Click to fetch from Discogs.
      </p>
      {albums.map((album) => (
        <div key={album.id} className="bg-gray-800 p-4 rounded mb-3 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">{album.artist} – {album.title}</h2>
            <p className="text-sm italic text-zinc-400">
              Year: {album.year || '–'} | Format: {album.format || '–'}
            </p>
          </div>
          <button
            className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 text-sm"
            onClick={() => fetchMetadata(album)}
          >
            Fetch Metadata
          </button>
        </div>
      ))}
      {status && <p className="mt-4 text-sm text-zinc-300 italic">{status}</p>}
    </div>
  );
}
