import '../styles/gatefold.css';

export default function AlbumGatefoldCard() {
  return (
    <div className="gatefold-container">
      <div className="album-cover">
        <img src="/images/sample-album-cover.jpg" alt="Sample Album Cover" />
      </div>
      <div className="album-info">
        <h2>Hotel California</h2>
        <h3>The Eagles</h3>
        <div className="tracklist">
          <h4>Side A</h4>
          <ul>
            <li>Hotel California</li>
            <li>New Kid in Town</li>
            <li>Life in the Fast Lane</li>
          </ul>
          <h4>Side B</h4>
          <ul>
            <li>Wasted Time</li>
            <li>Victim of Love</li>
            <li>The Last Resort</li>
          </ul>
        </div>
        <div className="actions">
          <button>Add to Queue</button>
        </div>
      </div>
    </div>
  );
}