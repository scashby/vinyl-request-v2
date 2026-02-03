// src/app/layout.tsx
import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
// FIXED: Named import
import { AuthProvider } from '../components/AuthProvider'; 
import NavigationMenu from '../components/NavigationMenu';
// FIXED: Named import

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ 
  subsets: ['latin'], 
  variable: '--font-serif-display',
  weight: ['400', '700', '900'] 
});

export const metadata = {
  title: 'Dead Wax Dialogues',
  description: 'Vinyl record collection manager and DJ booking page',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* FIXED: Removed 'bg-black text-white' to stop forced dark mode.
          The app will now use the defaults from globals.css.
      */}
      <body className={`${inter.variable} ${playfair.variable} font-sans min-h-screen pb-24 md:pb-0`}>
        <AuthProvider>
          {/* REMOVED: AlbumContextManager wrapper (Audio Recognition) */}
          <NavigationMenu />
          <main className="min-h-screen">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
