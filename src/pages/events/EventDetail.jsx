import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function EventDetail() {
  const { id } = useParams();
  const [collection, setCollection] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data: albums } = await supabase.from('collection').select('*');
      const { data: existingRequests } = await supabase
        .from('requests')
        .select('*')
        .eq('event_id', id);
      setCollection(albums);
      setRequests(existingRequests || []);
    }
    fetchData();
  }, [id]);

  const handleRequest = async (album, side) => {
    const existing = requests.find(r => r.album_id === album.id && r.side === side);
    if (existing) {
      await supabase.from('requests').update({ votes: existing.votes + 1 }).eq('id', existing.id);
    } else {
      await supabase.from('requests').insert({
        artist: album.artist,
        title: album.title,
        side,
        name: 'Guest',
        album_id: album.id,
        event_id: id,
        folder: album.folder,
        year: album.year,
        format: album.format,
        votes: 1
      });
    }
    const { data: updated } = await supabase.from('requests').select('*').eq('event_id', id);
    setRequests(updated);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Request Sides for Event</h1>
      {collection.map(album => {
        const sides = album.sides ? Object.keys(album.sides) : [];
        return (
          <div key={album.id} className="bg-gray-800 p-4 rounded shadow mb-4">
            <h2 className="text-xl font-semibold">{album.artist} – {album.title}</h2>
            {sides.map(side => {
              const match = requests.find(r => r.album_id === album.id && r.side === side);
              return (
                <div key={side} className="flex justify-between mt-2 items-center">
                  <span>Side {side}</span>
                  <button
                    className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => handleRequest(album, side)}
                  >
                    {match ? `Upvote (${match.votes})` : 'Request'}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
