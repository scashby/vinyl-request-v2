
// ✅ AlbumGatefoldCard.jsx
import React from 'react'
import './gatefold.css'

const AlbumGatefoldCard = ({ album }) => {
  const { title, artist, sides, image } = album

  return (
    <div className="gatefold">
      <div className="left-panel">
        <img src={image} alt={`${title} cover`} />
      </div>
      <div className="right-panel">
        <h1>{title}</h1>
        <h2>{artist}</h2>
        {Object.entries(sides).map(([sideLabel, tracks]) => (
          <div key={sideLabel}>
            <h3>{sideLabel}</h3>
            <ul>
              {tracks.map((track, index) => (
                <li key={index}>{track}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AlbumGatefoldCard
