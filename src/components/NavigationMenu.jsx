import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/navigation-menu.css';

function NavigationMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="nav-wrapper"
      style={{
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        zIndex: 1000
      }}
    >
      <button
        className="menu-toggle overlay"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation menu"
      >
        &#9776;
      </button>

      {open && (
        <div className="nav-panel">
          <nav>
            <ul>
              <li><Link to="/" onClick={() => setOpen(false)}>Home</Link></li>
              <li><Link to="/events" onClick={() => setOpen(false)}>Events</Link></li>
              <li><Link to="/browse" onClick={() => setOpen(false)}>Browse Albums</Link></li>
              <li><Link to="/about" onClick={() => setOpen(false)}>About</Link></li>
              {/* Add more links as needed */}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}

export default NavigationMenu;
