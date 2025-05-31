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
    <div className="album-detail" style={{ backgroundImage: `url(${album.cover})` }}>
      <div className="overlay">
        <div className="album-meta">
          <img src={album.cover} alt={album.title} className="album-art" />
          <div>
            <h1>{album.title}</h1>
            <p>{album.artist} • {album.year}</p>
            <div className="media-badge bg-purple-600">{album.format}</div>
            <p className="track-meta">9 TRACKS</p>
          </div>
        </div>
        <table className="track-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Artist</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {album.tracks.map((track, index) => {
              const prefix = index < 4 ? `A${index + 1}` : `B${index - 3}`;
              return (
                <tr key={index}>
                  <td>{prefix}</td>
                  <td>{track}</td>
                  <td>{album.artist}</td>
                  <td>{album.durations[index]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
