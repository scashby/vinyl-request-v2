// src/app/layout.tsx
import './globals.css';
// FIXED: Named import
import { AuthProvider } from '../components/AuthProvider';
import NavigationMenu from '../components/NavigationMenu';
import Footer from '../components/Footer';
import { Alfa_Slab_One, Inter, Libre_Barcode_EAN13_Text, Playfair_Display, Work_Sans } from 'next/font/google';
// FIXED: Named import

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

const libreBarcode = Libre_Barcode_EAN13_Text({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-libre-barcode',
});

// Brand type for the v2 redesign (homepage, nav, footer) — kept separate from
// the site-wide Inter/Playfair pairing so unrestyled pages are unaffected.
const alfaSlab = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-alfa-slab',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
});

export const metadata = {
  title: {
    default: 'Dead Wax Dialogues',
    template: 'Dead Wax Dialogues | %s',
  },
  description: 'DJ sets, residency nights, and vinyl-fueled community from Dead Wax Dialogues.',
  icons: {
    icon: '/images/Skulllogo.png',
  },
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
      <body className={`${inter.variable} ${playfair.variable} ${libreBarcode.variable} ${alfaSlab.variable} ${workSans.variable} font-sans min-h-screen flex flex-col`}>
        <AuthProvider>
          {/* REMOVED: AlbumContextManager wrapper (Audio Recognition) */}
          <NavigationMenu />
          <main className="min-h-screen flex-1">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
// AUDIT: updated for V3 alignment, UI parity, and build stability.
