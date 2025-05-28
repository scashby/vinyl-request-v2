import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

export default function BrowsePage() {
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    async function fetchAlbums() {
      const { data, error } = await supabase.from('collection').select('*');
      if (error) console.error('Error fetching collection:', error);
      else setAlbums(data);
    }
    fetchAlbums();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Browse Collection</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {albums.map(album => (
          <div key={album.id} className="bg-gray-800 p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{album.artist}</h2>
            <p className="italic">{album.title} ({album.year})</p>
            {album.image_url && (
              <img src={album.image_url} alt={album.title} className="mt-2 w-full h-48 object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
