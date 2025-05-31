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
    durations: ['4:08','4:00','2:35','3:58','3:36','5:04','3:30','4:44','4:30']
  };

  return (
    <div className="detail-page" style={{ backgroundImage: `url(${album.cover})` }}>
      <div className="detail-overlay">
        <div className="album-left">
          <img src={album.cover} alt={album.title} className="detail-cover" />
        </div>
        <div className="album-right">
          <h1>{album.title}</h1>
          <p>{album.artist} • {album.year}</p>
          <div className="media-badge bg-purple-600">{album.format}</div>
          <p className="track-count">9 TRACKS</p>
          <table className="tracklist">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {album.tracks.map((track, i) => {
                const prefix = i < 4 ? `A${i + 1}` : `B${i - 3}`;
                return (
                  <tr key={i}>
                    <td>{prefix}</td>
                    <td>{track}</td>
                    <td>{album.artist}</td>
                    <td>{album.durations[i]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}