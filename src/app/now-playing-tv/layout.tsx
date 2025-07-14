// src/app/now-playing-tv/layout.tsx - Fixed layout that prevents menus AND hydration issues
import { ReactNode } from 'react';

export default function TVLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {/* Global CSS to completely hide navigation elements */}
      <style dangerouslySetInnerHTML={{
        __html: `
        /* FORCE REMOVE ANY NAVIGATION OR MENUS */
        .menu-toggle,
        .navigation-menu,
        .hamburger-menu,
        nav,
        .nav,
        .menu-panel,
        .admin-sidebar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* ENSURE CLEAN TV DISPLAY */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: #000 !important;
          color: #fff !important;
          font-family: "Inter", sans-serif !important;
          width: 100vw !important;
          height: 100vh !important;
        }
        
        /* REMOVE ANY POSSIBLE OVERLAYS OR MENUS */
        [class*="menu"],
        [class*="nav"],
        [class*="hamburger"],
        [id*="menu"],
        [id*="nav"] {
          display: none !important;
        }
        
        /* ENSURE FULL SCREEN COVERAGE */
        #__next,
        .layout,
        .app,
        main {
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #000 !important;
        }
        `
      }} />
      
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        zIndex: 9999
      }}>
        {children}
      </div>
    </>
  );
}