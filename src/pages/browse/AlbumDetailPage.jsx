import React from 'react';
import '../../styles/album-detail.css';

const album = {
  title: 'British Steel',
  artist: 'Judas Priest',
  year: '1980',
  image: '/images/british-steel.jpg',
  format: 'Vinyl',
  tracks: [
    { side: 'A', number: 1, title: 'Rapid Fire', time: '4:08' },
    { side: 'A', number: 2, title: 'Metal Gods', time: '4:00' },
    { side: 'A', number: 3, title: 'Breaking the Law', time: '2:35' },
    { side: 'A', number: 4, title: 'Grinder', time: '3:58' },
    { side: 'B', number: 1, title: 'United', time: '3:36' },
    { side: 'B', number: 2, title: 'You Don’t Have to Be Old to Be Wise', time: '5:04' },
    { side: 'B', number: 3, title: 'Living After Midnight', time: '3:30' },
    { side: 'B', number: 4, title: 'The Rage', time: '4:44' },
    { side: 'B', number: 5, title: 'Steeler', time: '4:30' },
  ],
};

export default function AlbumDetailPage() {
  return (
    <div className="album-detail" style={{ backgroundImage: `url(${album.image})` }}>
      <div className="album-overlay">
        <img src={album.image} alt={album.title} className="album-art" />
        <div className="album-info">
          <h1 className="album-title">{album.title}</h1>
          <p className="album-meta">{album.artist} • {album.year}</p>
          <div className="album-badge">{album.format}</div>
          <p className="album-tracks">{album.tracks.length} TRACKS</p>
        </div>
        <table className="tracklist">
          <thead>
            <tr><th>#</th><th>Title</th><th>Artist</th><th>Time</th></tr>
          </thead>
          <tbody>
            {album.tracks.map((track, i) => (
              <tr key={i}>
                <td>{track.side}{track.number}</td>
                <td>{track.title}</td>
                <td>{album.artist}</td>
                <td>{track.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
