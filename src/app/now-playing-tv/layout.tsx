// src/app/now-playing-tv/layout.tsx - Clean layout without navigation for TV display
import { ReactNode } from 'react';

export default function TVLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Dead Wax Dialogues - Now Playing</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ 
        background: '#000', 
        color: '#fff', 
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontFamily: '"Inter", sans-serif'
      }}>
        {/* No navigation menu - completely clean for TV display */}
        {children}
      </body>
    </html>
  );
}