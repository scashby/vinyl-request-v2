"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

function NavigationMenu() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-2 left-2 z-[1000]">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation menu"
        className={`bg-transparent border border-gray-400 text-3xl cursor-pointer p-1 leading-none rounded transition-colors duration-200 ${
          isScrolled ? 'text-black border-gray-600' : 'text-white border-gray-400'
        }`}
      >
        &#9776;
      </button>

      {open && (
        <div className="absolute top-0 left-[3.5rem] bg-white shadow-lg rounded-lg p-2 w-[160px]">
          <ul className="list-none m-0 p-0 space-y-1">
            <li>
              <Link href="/" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">Home</Link>
            </li>
            <li>
              <Link href="/events/events-page" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">Events</Link>
            </li>
            <li>
              <Link href="/dj-sets" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">DJ Sets</Link>
            </li>
            <li>
              <Link href="/browse/browse-albums" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">Browse Albums</Link>
            </li>
            <li>
              <Link href="/dialogues" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">Dialogues</Link>
            </li>
            <li>
              <Link href="/about" onClick={() => setOpen(false)} className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors">About</Link>
            </li>
            <li>
              <a 
                href="https://shop.deadwaxdialogues.com" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-2 py-1.5 text-sm text-gray-900 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors"
              >
                Merch
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default NavigationMenu;