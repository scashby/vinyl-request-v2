import React from 'react';
import '../styles/gatefold.css';

const AlbumGatefoldCard = () => (
  <div className="gatefold-container">
    <div className="gatefold-left">
      <img src="/images/hotel-california-inside-gatefold-768x512.webp" alt="Album Cover" />
    </div>
    <div className="gatefold-right">
      <h2>Hotel California</h2>
      <h3>The Eagles</h3>
      <div>
        <h4>Side A</h4>
        <ul>
          <li>Hotel California</li>
          <li>New Kid in Town</li>
          <li>Life in the Fast Lane</li>
          <li>Wasted Time</li>
        </ul>
        <h4>Side B</h4>
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

export default AlbumGatefoldCard;
