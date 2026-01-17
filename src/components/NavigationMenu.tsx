"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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

  const navLinks = [
    { name: 'Events', path: '/events/events-page' },
    { name: 'DJ Sets', path: '/dj-sets' },
    { name: 'Browse Albums', path: '/browse/browse-albums' },
    { name: 'Dialogues', path: '/dialogues' },
    { name: 'About', path: '/about' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
          isScrolled 
            ? 'bg-black/80 backdrop-blur-md border-b border-white/10 py-3 shadow-lg' 
            : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          
          {/* Logo / Brand Area */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-serif-display font-bold text-2xl tracking-tight text-white group-hover:text-[#00c4ff] transition-colors">
              DWD
            </span>
          </Link>

          {/* Desktop Navigation */}
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
             <a 
                href="https://shop.deadwaxdialogues.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-bold uppercase tracking-wider text-zinc-300 hover:text-[#00c4ff] transition-colors"
              >
                Merch
              </a>
          </div>

          {/* Mobile Menu Toggle */}
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

      {/* Mobile Menu Overlay */}
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
         <a 
            href="https://shop.deadwaxdialogues.com" 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-2xl font-bold uppercase tracking-widest text-zinc-400 hover:text-[#00c4ff]"
          >
            Merch
          </a>
      </div>
    </>
  );
}