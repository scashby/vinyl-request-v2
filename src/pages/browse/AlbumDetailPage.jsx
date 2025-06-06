import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/album-detail.css';

function AlbumDetailPage() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [side, setSide] = useState('A');

  useEffect(() => {
    const fetchAlbum = async () => {
      const { data, error } = await supabase
        .from('collection')
        .select('*')
        .eq('id', id)
        .single();

      if (!error) setAlbum(data);
    };
    fetchAlbum();
  }, [id]);

  if (!album) return <div className="page-wrapper">Loading...</div>;

  const tracklist = album.tracklist ? JSON.parse(album.tracklist) : [];

  return (
    <div className="album-detail">
      <div className="background-blur"></div>
      <div className="album-header">
        <img className="album-art" src={album.image_url || '/images/coverplaceholder.png'} alt={album.title} />
        <div className="album-info">
          <h1 className="title text-white text-3xl font-bold">{album.title}</h1>
          <p className="artist text-gray-200">{album.artist} • {album.year}</p>
          <span className="badge bg-purple-600 text-white text-xs px-2 py-1 rounded">{album.folder}</span>
          <p className="meta text-gray-400 text-sm mt-2">{tracklist.length} TRACKS</p>
        </div>
      </div>

      <div className="tracklist text-white">
        <div className="tracklist-header font-bold text-sm border-b border-gray-600 pb-2 mb-2 grid grid-cols-4 gap-4">
          <span>#</span><span>Title</span><span>Artist</span><span>Time</span>
        </div>
        {tracklist.map(([num, title, artist, time]) => (
          <div key={num} className="track grid grid-cols-4 gap-4 py-1">
            <span>{num}</span><span>{title}</span><span>{artist}</span><span>{time}</span>
          </div>
        ))}
      </div>

      <div className="queue-controls text-white mt-6">
        <label className="block mb-2">Choose Side:</label>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value)}
          className="text-black p-2 rounded mb-4"
        >
          <option value="A">Side A</option>
          <option value="B">Side B</option>
        </select>

        <button className="ml-4 bg-blue-600 text-white px-4 py-2 rounded">
          Add to Queue
        </button>
      </div>
    </div>
  );
}

export default AlbumDetailPage;
