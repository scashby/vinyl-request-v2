import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/navigation-menu.css';

function NavigationMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', top: '0.5rem', left: '0.5rem', zIndex: 1000 }}>
      <button
        className="menu-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation menu"
      >
        &#9776;
      </button>

      {open && (
        <div className="menu-panel">
          <ul>
            <li><Link to="/" onClick={() => setOpen(false)}>Home</Link></li>
            <li><Link to="/events" onClick={() => setOpen(false)}>Events</Link></li>
            <li><Link to="/browse" onClick={() => setOpen(false)}>Browse Albums</Link></li>
            <li><Link to="/about" onClick={() => setOpen(false)}>About</Link></li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default NavigationMenu;
