import React from 'react';
import '../styles/internal.css';

const InternalLayout = ({ title, children }) => {
  return (
    <div className="internal-wrapper">
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main className="page-body">
        {children}
      </main>
      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </div>
  );
};

export default InternalLayout;
