"use client";

import NavigationMenu from './NavigationMenu';
import Footer from '../components/Footer';
import { usePathname } from 'next/navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showLayout = pathname !== '/login';

  return (
    <div className="bg-white text-zinc-900 min-h-screen flex flex-col">
      {showLayout && <NavigationMenu />}
      <main className="flex-grow">{children}</main>
      {showLayout && <Footer />}
    </div>
  );
}
