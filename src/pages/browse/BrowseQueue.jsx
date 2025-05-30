
import React from 'react';
import '../../styles/internal.css';
import '../../styles/browse-queue.css';


const BrowseQueue = () => {
  return (
    <div className="page-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>Event Name Placeholder</h1>
        </div>
      </header>
      <main className="page-body browse-queue">
        <aside className="event-sidebar">
          <img src="/images/event-placeholder.jpg" alt="Event poster" className="event-sidebar-image" />
          <div className="event-sidebar-details">
            <h2>Event Title</h2>
            <p>Date: June 15, 2025</p>
            <p>Time: 7:00 PM</p>
            <p>Location: Vinyl Taproom</p>
          </div>
        </aside>
        <section className="queue-display">
          <h2>Queue</h2>
          <table className="queue-table">
            <thead>
              <tr>
                <th>Album</th>
                <th>Artist</th>
                <th>Side</th>
                <th>Votes</th>
                <th>Like</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>The Dark Side of the Moon</td>
                <td>Pink Floyd</td>
                <td>A</td>
                <td className="votes">★★★★☆</td>
                <td><button className="vote-button">👍</button></td>
              </tr>
              <tr>
                <td>Abbey Road</td>
                <td>The Beatles</td>
                <td>B</td>
                <td className="votes">★★★★★+</td>
                <td><button className="vote-button">👍</button></td>
              </tr>
              <tr>
                <td>Random Album</td>
                <td>Unknown Artist</td>
                <td>A</td>
                <td className="votes">☆☆☆☆☆</td>
                <td><button className="vote-button">👍</button></td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
};

export default BrowseQueue;
