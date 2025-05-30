import React from 'react';
import '../styles/gatefold.css';

const AlbumGatefoldCard = () => {
  return (
    <div className="gatefold-container">
      <div className="gatefold-left">
        <img
          src="https://i.discogs.com/PZz0RZth-jDXq_vEwv640MTGizMZe5KEc6KTzM6ZKzY/rs:fit/g:sm/q:90/h:600/w:596/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEzNTQ4/MTYtMTM4MzkwOTE3/MC0xNzEyLmpwZWc.jpeg"
          alt="Album Cover"
          className="album-cover"
        />
      </div>
      <div className="gatefold-right">
        <h2 className="album-title">Hotel California</h2>
        <p className="album-artist">Eagles</p>
        <div className="album-sides">
          <h3>Side A</h3>
          <ul>
            <li>Hotel California</li>
            <li>New Kid in Town</li>
            <li>Life in the Fast Lane</li>
            <li>Wasted Time</li>
          </ul>
          <h3>Side B</h3>
          <ul>
            <li>Wasted Time (Reprise)</li>
            <li>Victim of Love</li>
            <li>Pretty Maids All in a Row</li>
            <li>Try and Love Again</li>
            <li>The Last Resort</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AlbumGatefoldCard;