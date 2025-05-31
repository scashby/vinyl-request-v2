import React from 'react';
import '../../styles/album-detail.css';

export default function AlbumDetailPage() {
  const album = {
    title: 'British Steel',
    artist: 'Judas Priest',
    year: 1980,
    format: 'Vinyl',
    cover: '/images/british-steel.jpg',
    tracks: [
      'Rapid Fire',
      'Metal Gods',
      'Breaking the Law',
      'Grinder',
      'United',
      'You Don’t Have to Be Old to Be Wise',
      'Living After Midnight',
      'The Rage',
      'Steeler'
    ],
    durations: ['4:08', '4:00', '2:35', '3:58', '3:36', '5:04', '3:30', '4:44', '4:30']
  };

  return (
    <div
      className="album-detail bg-cover bg-center min-h-screen text-white"
      style={{
        backgroundImage: `url(${album.cover})`
      }}
    >
      <div className="bg-black bg-opacity-70 min-h-screen p-6">
        <div className="flex items-center gap-6 mb-6">
          <img src={album.cover} alt={album.title} className="w-40 h-40 rounded shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold">{album.title}</h1>
            <p className="text-sm text-gray-300">{album.artist} • {album.year}</p>
            <div className="inline-block mt-2 text-xs text-white px-2 py-1 rounded bg-purple-600">
              {album.format}
            </div>
            <p className="text-sm text-gray-300 mt-1">9 TRACKS</p>
          </div>
        </div>
        <table className="w-full text-sm bg-black bg-opacity-40 rounded">
          <thead>
            <tr className="text-left border-b border-gray-600">
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-3">Artist</th>
              <th className="py-2 px-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {album.tracks.map((track, index) => {
              const trackNum = index < 4 ? `A${index + 1}` : `B${index - 3}`;
              return (
                <tr key={index} className="border-t border-gray-700">
                  <td className="py-2 px-3">{trackNum}</td>
                  <td className="py-2 px-3">{track}</td>
                  <td className="py-2 px-3">{album.artist}</td>
                  <td className="py-2 px-3">{album.durations[index]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
