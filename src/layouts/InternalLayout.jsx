import React from 'react';
import '../styles/internal.css';

const InternalLayout = ({ title, children }) => {
  return (
    <>
      <header className="event-hero">
        <div className="overlay">
          <h1>{title}</h1>
        </div>
      </header>
      <main className="event-body">
        {children}
      </main>
      <footer className="footer">
        © 2025 Dead Wax Dialogues
      </footer>
    </>
  );
};

export default InternalLayout;
