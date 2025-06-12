"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import 'styles/navigation-menu.css';

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
            <li>
              <Link href="/" onClick={() => setOpen(false)}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/events/events-page" onClick={() => setOpen(false)}>
                Events
              </Link>
            </li>
            <li>
              <Link href="/browse/browse-albums" onClick={() => setOpen(false)}>
                Browse Albums
              </Link>
            </li>
            <li>
              <Link href="/dialogues" onClick={() => setOpen(false)}>
                Dialogues
              </Link>
            </li>
            <li>
              <Link href="/about" onClick={() => setOpen(false)}>
                About
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default NavigationMenu;
