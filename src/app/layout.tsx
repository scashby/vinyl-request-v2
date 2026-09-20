// src/app/layout.tsx
import './globals.css';
// FIXED: Named import
import { AuthProvider } from '../components/AuthProvider';
import NavigationMenu from '../components/NavigationMenu';
import Footer from '../components/Footer';
import { getActiveTheme } from 'src/lib/getActiveThemeServer';
import { ActiveThemeProvider } from 'src/components/ActiveThemeProvider';
import {
  Alfa_Slab_One,
  Archivo,
  Archivo_Black,
  Inter,
  Karla,
  Libre_Barcode_EAN13_Text,
  Playfair_Display,
  Space_Grotesk,
  Work_Sans,
} from 'next/font/google';
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
// All three theme directions' fonts load up front (next/font can't pick a
// Google Font dynamically at runtime); the active theme just decides which
// --font-* variable the "--dwd-font-*" tokens point at. See src/lib/theme.ts.
const alfaSlab = Alfa_Slab_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-alfa-slab',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
});

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo-black',
});

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const karla = Karla({
  subsets: ['latin'],
  variable: '--font-karla',
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

// Re-resolves the active theme at most every 5 minutes instead of on every
// request, so an admin theme switch shows up site-wide within a few
// minutes without paying for a live DB read on every page view.
export const revalidate = 300;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getActiveTheme();
  return (
    <html lang="en">
      {/* FIXED: Removed 'bg-black text-white' to stop forced dark mode.
          The app will now use the defaults from globals.css.
      */}
      <body className={`${inter.variable} ${playfair.variable} ${libreBarcode.variable} ${alfaSlab.variable} ${workSans.variable} ${archivoBlack.variable} ${archivo.variable} ${spaceGrotesk.variable} ${karla.variable} font-sans min-h-screen flex flex-col`}>
        <ActiveThemeProvider theme={theme}>
          <AuthProvider>
            {/* REMOVED: AlbumContextManager wrapper (Audio Recognition) */}
            <NavigationMenu />
            <main className="min-h-screen flex-1">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ActiveThemeProvider>
      </body>
    </html>
  );
}
// AUDIT: updated for V3 alignment, UI parity, and build stability.
