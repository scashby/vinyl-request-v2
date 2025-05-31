import React from 'react';
import '../../styles/album-detail.css';

const AlbumDetailPage = () => {
  const album = {
    title: "British Steel",
    artist: "Judas Priest",
    year: 1980,
    cover: "/images/judas-priest-british-steel.jpg",
    format: "Vinyl",
    sides: {
      A: [
        "Rapid Fire",
        "Metal Gods",
        "Breaking the Law",
        "Grinder"
      ],
      B: [
        "United",
        "You Don’t Have to Be Old to Be Wise",
        "Living After Midnight",
        "The Rage",
        "Steeler"
      ]
    }
  };

  const totalTracks = Object.values(album.sides).reduce((a, b) => a + b.length, 0);

  return (
    <div className="album-detail-page" style={{ backgroundImage: `url(${album.cover})` }}>
      <div className="album-detail-overlay">
        <div className="album-detail-content">
          <img src={album.cover} alt={album.title} className="album-cover" />
          <div className="album-info">
            <h1 className="album-title">{album.title}</h1>
            <h2 className="album-artist">{album.artist} • {album.year}</h2>
            <span className="badge badge-vinyl">{album.format}</span>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Side A / B • {totalTracks} TRACKS</p>
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
                  {Object.entries(album.sides).flatMap(([side, tracks], sideIndex) =>
                    tracks.map((title, index) => {
                      const trackNumber = `${side}${index + 1}`;
                      const duration = ["4:08","4:00","2:35","3:58","3:36","5:04","3:30","4:44","4:30"][(sideIndex ? 4 : 0) + index];
                      return (
                        <tr key={trackNumber}>
                          <td>{trackNumber}</td>
                          <td>{title}</td>
                          <td>{album.artist}</td>
                          <td>{duration}</td>
                        </tr>
                      );
                    })
                  )}
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