import Footer from './Footer';
import { usePathname } from 'next/navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showLayout = pathname !== '/login';

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col">
      <main className="flex-grow px-4 py-6">{children}</main>
      {showLayout && <Footer />}
    </div>
  );
}
