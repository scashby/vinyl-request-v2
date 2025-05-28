import Header from './Header';
import Footer from './Footer';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const showLayout = pathname !== '/login';

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col">
      {showLayout && <Header />}
      <main className="flex-grow px-4 py-6">{children}</main>
      {showLayout && <Footer />}
    </div>
  );
}
