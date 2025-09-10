// src/app/tv-display/layout.tsx - CLEAN LAYOUT FOR TV DISPLAY
import { ReactNode } from 'react';

interface TVDisplayLayoutProps {
  children: ReactNode;
}

export default function TVDisplayLayout({ children }: TVDisplayLayoutProps) {
  return (
    <html lang="en">
      <head>
        <title>Dead Wax Dialogues - TV Display</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            height: 100%;
            overflow: hidden;
            background: #000;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}