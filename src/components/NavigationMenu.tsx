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
      // Trigger slightly earlier for smoother feel
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? 'bg-black/90 backdrop-blur-md border-b border-white/5 py-2 shadow-2xl'
            : 'bg-transparent border-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          
          {/* Logo */}
          <Link href="/" className="relative z-50 flex items-center gap-2 group">
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
                  className={`text-sm font-bold uppercase tracking-widest transition-all duration-200 hover:text-[#00c4ff] ${
                    isActive ? 'text-[#00c4ff]' : 'text-white/80'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
             <a 
                href="https://shop.deadwaxdialogues.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest text-white hover:bg-[#00c4ff] hover:border-[#00c4ff] hover:text-black transition-all"
              >
                Merch
              </a>
          </div>

          {/* Mobile Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden relative z-50 p-2 text-white hover:text-[#00c4ff] transition-colors focus:outline-none"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <span className={`block w-full h-0.5 bg-current transition-transform duration-300 origin-left ${isMobileMenuOpen ? 'rotate-45 translate-x-1' : ''}`} />
              <span className={`block w-full h-0.5 bg-current transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-full h-0.5 bg-current transition-transform duration-300 origin-left ${isMobileMenuOpen ? '-rotate-45 translate-x-1' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div 
        className={`fixed inset-0 z-40 bg-black transition-all duration-500 md:hidden flex flex-col items-center justify-center gap-8 ${
          isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        {navLinks.map((item, idx) => (
          <Link
            key={item.path}
            href={item.path}
            className={`text-3xl font-serif-display font-bold text-white hover:text-[#00c4ff] transition-all duration-300 transform ${
              isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
            style={{ transitionDelay: `${idx * 50}ms` }}
          >
            {item.name}
          </Link>
        ))}
         <a 
            href="https://shop.deadwaxdialogues.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-8 text-xl font-bold uppercase tracking-widest text-white/50 hover:text-[#00c4ff] transition-colors"
          >
            Shop Merch
          </a>
      </div>
    </>
  );
}