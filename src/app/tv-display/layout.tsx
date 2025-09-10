// src/app/tv-display/layout.tsx - CLEAN LAYOUT WITHOUT NAVIGATION
import { ReactNode } from 'react';

interface TVDisplayLayoutProps {
  children: ReactNode;
}

export default function TVDisplayLayout({ children }: TVDisplayLayoutProps) {
  return (
    <>
      {children}
    </>
  );
}