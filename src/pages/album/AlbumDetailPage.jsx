import React from 'react';
import '../../styles/album-detail.css';

const album = {
  title: 'British Steel',
  artist: 'Judas Priest',
  year: 1980,
  image: '/images/british-steel.jpg',
  format: 'Vinyl',
  tracks: [
    { number: 'A1', title: 'Rapid Fire', time: '4:08' },
    { number: 'A2', title: 'Metal Gods', time: '4:00' },
    { number: 'A3', title: 'Breaking the Law', time: '2:35' },
    { number: 'A4', title: 'Grinder', time: '3:58' },
    { number: 'B1', title: 'United', time: '3:36' },
    { number: 'B2', title: 'You Don’t Have to Be Old to Be Wise', time: '5:04' },
    { number: 'B3', title: 'Living After Midnight', time: '3:30' },
    { number: 'B4', title: 'The Rage', time: '4:44' },
    { number: 'B5', title: 'Steeler', time: '4:30' },
  ]
};

export default function AlbumDetailPage() {
  return (
    <div className="album-detail">
      <div className="background-blur" style={{ backgroundImage: `url(${album.image})` }}></div>
      <div className="album-header">
        <img className="album-art" src={album.image} alt={album.title} />
        <div className="album-info">
          <h1 className="title">{album.title}</h1>
          <p className="artist">{album.artist} • {album.year}</p>
          <span className="badge vinyl">Vinyl</span>
          <p className="meta">Side A / B • {album.tracks.length} TRACKS</p>
        </div>
      </div>
      <div className="tracklist">
        <div className="tracklist-header">
          <span>#</span>
          <span>Title</span>
          <span>Artist</span>
          <span>Time</span>
        </div>
        {album.tracks.map((track, index) => (
          <div className="track" key={index}>
            <span>{track.number}</span>
            <span>{track.title}</span>
            <span>{album.artist}</span>
            <span>{track.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
