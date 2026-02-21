// src/components/NavigationMenu.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function NavigationMenu() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // HIDE MENU: Check condition AFTER all hooks are called
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/edit-collection')) {
    return null;
  }

  const navLinks = [
    { name: 'About', path: '/about' },
    { name: 'Events', path: '/events/events-page' },
    { name: 'Games', path: '/games' },
    { name: 'Browse Collection', path: '/browse/browse-albums' },
    { name: 'DJ Sets', path: '/dj-sets' },
    { name: 'Dialogues', path: '/dialogues' },
    { name: 'Merch', path: '/merch' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
          isScrolled 
            ? 'bg-black/90 backdrop-blur-md border-b border-white/10 py-2 shadow-lg' 
            : 'bg-transparent border-transparent py-4'
        }`}
      >
        <div className="w-full px-6 md:px-10 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <Image 
                src="/images/Skulllogo.png" 
                alt="DWD" 
                fill
                className="object-contain invert brightness-0 invert-100 transition-transform group-hover:scale-105"
                style={{ filter: 'invert(1)' }}
              />
            </div>
            <div className="relative w-32 h-8 hidden sm:block">
              <Image 
                src="/images/Text.png" 
                alt="Dead Wax Dialogues" 
                fill
                className="object-contain"
                style={{ filter: 'invert(1)' }}
              />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative text-sm font-bold uppercase tracking-wider transition-colors duration-200 ${
                    isActive ? 'text-[#00c4ff]' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-white hover:text-[#00c4ff] transition-colors z-50 relative"
            aria-label="Toggle menu"
          >
            <div className="space-y-1.5 w-6">
              <span className={`block w-full h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-full h-0.5 bg-current transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-full h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      <div 
        className={`fixed inset-0 z-40 bg-black/95 backdrop-blur-xl transition-all duration-300 md:hidden flex flex-col items-center justify-center gap-8 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        <Link 
            href="/" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-3xl font-serif-display font-bold text-white mb-4"
        >
            Home
        </Link>
        {navLinks.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-2xl font-bold uppercase tracking-widest ${
              pathname === item.path ? 'text-[#00c4ff]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </>
  );
}
// AUDIT: inspected, no changes.
