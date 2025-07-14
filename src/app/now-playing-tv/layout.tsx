// src/app/now-playing-tv/layout.tsx - Simplified layout that works with main layout exclusion
import { ReactNode } from 'react';

export default function TVLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: '"Inter", sans-serif',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {children}
    </div>
  );
}