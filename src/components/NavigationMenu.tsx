// src/components/NavigationMenu.tsx
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { DEFAULT_THEME, THEMES, isThemeName, toCssVars, type ThemeName } from 'src/lib/theme';

export default function NavigationMenu() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);
  const pathname = usePathname();

  // Mobile menu should never persist open across a route change.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/site-theme')
      .then((res) => res.json())
      .then((data) => {
        if (isThemeName(data?.theme)) setThemeName(data.theme);
      })
      .catch((err) => console.error('Error loading active theme:', err));
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

  const theme = THEMES[themeName];
  const cssVars = toCssVars(theme) as React.CSSProperties;

  return (
    <div style={cssVars}>
      <nav className="sticky top-0 left-0 right-0 z-50 bg-[var(--dwd-nav-bg)]/95 backdrop-blur-sm border-b border-[var(--dwd-ink)]/10">
        <div className="w-full px-6 md:px-10 py-3 flex items-center justify-between">

          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9">
              <Image
                src="/images/Skulllogo.png"
                alt="DWD"
                fill
                className="object-contain transition-transform group-hover:scale-105"
              />
            </div>
            <div className="relative w-32 h-8 hidden sm:block">
              <Image
                src="/images/Text.png"
                alt="Dead Wax Dialogues"
                fill
                className="object-contain"
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
                    isActive ? 'text-[var(--dwd-accent-2)]' : 'text-[var(--dwd-ink)]/70 hover:text-[var(--dwd-ink)]'
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--dwd-accent-2)]" />
                  )}
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[var(--dwd-ink)] hover:text-[var(--dwd-accent-2)] transition-colors z-50 relative"
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
        className={`fixed inset-0 z-40 bg-[var(--dwd-nav-bg)] transition-all duration-300 md:hidden flex flex-col items-center justify-center gap-8 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-3xl font-serif-display font-bold text-[var(--dwd-ink)] mb-4"
        >
            Home
        </Link>
        {navLinks.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`text-2xl font-bold uppercase tracking-widest ${
              pathname === item.path ? 'text-[var(--dwd-accent-2)]' : 'text-[var(--dwd-ink)]/70 hover:text-[var(--dwd-ink)]'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
// AUDIT: theme-aware via src/lib/theme.ts (was hardcoded to the Sunday Matinee hybrid palette).
