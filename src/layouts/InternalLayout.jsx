// ✅ InternalLayout.jsx — shared layout for internal pages
import React from 'react';
import '../styles/internal.css';

const InternalLayout = ({ title, children }) => {
  return (
    <div className="internal-page">
      <header className="internal-header">
        <img src="/images/event-header-still.jpg" alt="Event Header" className="header-image" />
        <h1 className="header-title">{title}</h1>
      </header>
      <main className="internal-content">
        {children}
      </main>
    </div>
  );
};

export default InternalLayout;
