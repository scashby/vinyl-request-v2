import React from 'react';
import '../styles/internal.css';

const PageLayout = ({ children }) => {
  return (
    <div className="internal-page">
      <header className="event-hero">
        <div className="overlay">
          <h1>Upcoming Vinyl Nights</h1>
        </div>
      </header>
      <main className="page-body">{children}</main>
    </div>
  );
};

export default PageLayout;
