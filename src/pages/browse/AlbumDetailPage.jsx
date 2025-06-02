import React from 'react';
import '../../styles/album-detail.css';

function AlbumDetailPage() {
  const tracklist = [
    ['A1', 'Rapid Fire', 'Judas Priest', '4:08'],
    ['A2', 'Metal Gods', 'Judas Priest', '4:00'],
    ['A3', 'Breaking the Law', 'Judas Priest', '2:35'],
    ['A4', 'Grinder', 'Judas Priest', '3:58'],
    ['B1', 'United', 'Judas Priest', '3:36'],
    ['B2', "You Don’t Have to Be Old to Be Wise", 'Judas Priest', '5:04'],
    ['B3', 'Living After Midnight', 'Judas Priest', '3:30'],
    ['B4', 'The Rage', 'Judas Priest', '4:44'],
    ['B5', 'Steeler', 'Judas Priest', '4:30'],
  ];

  return (
    <div className="album-detail">
      <div className="background-blur"></div>
      <div className="album-header">
        <img className="album-art" src="/images/judas-priest-british-steel.jpg" alt="British Steel" />
        <div className="album-info">
          <h1 className="title text-white text-3xl font-bold">British Steel</h1>
          <p className="artist text-gray-200">Judas Priest • 1980</p>
          <span className="badge bg-purple-600 text-white text-xs px-2 py-1 rounded">Vinyl</span>
          <p className="meta text-gray-400 text-sm mt-2">9 TRACKS</p>
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
    </div>
  );
}

export default AlbumDetailPage;
