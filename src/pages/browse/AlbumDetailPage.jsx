import React from 'react';
import '../../styles/album-detail.css';

const AlbumDetailPage = () => {
  const album = {
    title: "British Steel",
    artist: "Judas Priest",
    year: 1980,
    cover: "/images/judas-priest-british-steel.jpg",
    format: "Vinyl",
    tracks: [
      { id: "A1", title: "Rapid Fire", artist: "Judas Priest", time: "4:08" },
      { id: "A2", title: "Metal Gods", artist: "Judas Priest", time: "4:00" },
      { id: "A3", title: "Breaking the Law", artist: "Judas Priest", time: "2:35" },
      { id: "A4", title: "Grinder", artist: "Judas Priest", time: "3:58" },
      { id: "B1", title: "United", artist: "Judas Priest", time: "3:36" },
      { id: "B2", title: "You Don’t Have to Be Old to Be Wise", artist: "Judas Priest", time: "5:04" },
      { id: "B3", title: "Living After Midnight", artist: "Judas Priest", time: "3:30" },
      { id: "B4", title: "The Rage", artist: "Judas Priest", time: "4:44" },
      { id: "B5", title: "Steeler", artist: "Judas Priest", time: "4:30" },
    ]
  };

  return (
    <div className="album-detail-page" style={{ backgroundImage: `url(${album.cover})` }}>
      <div className="album-detail-overlay">
        <div className="album-detail-content">
          <img src={album.cover} alt={album.title} className="album-cover" />
          <div className="album-info">
            <h1 className="album-title">{album.title}</h1>
            <h2 className="album-artist">{album.artist} • {album.year}</h2>
            <span className="badge badge-vinyl">{album.format}</span>
            <p className="track-count">{album.tracks.length} TRACKS</p>
            <div className="tracklist">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {album.tracks.map((track) => (
                    <tr key={track.id}>
                      <td>{track.id}</td>
                      <td>{track.title}</td>
                      <td>{track.artist}</td>
                      <td>{track.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailPage;