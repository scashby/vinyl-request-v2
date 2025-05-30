
import { useLocation } from 'react-router-dom';
import './Header.css';

function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="header-container">
      {isHome ? (
        <video autoPlay muted loop playsInline className="background-video">
          <source src="/hero-background.mp4" type="video/mp4" />
        </video>
      ) : (
        <img src="/event-header-still.jpg" alt="Header" className="header-image" />
      )}
      <div className="header-content">
        <h1>Dead Wax Dialogues</h1>
        <nav>
          <a href="/">Home</a>
          <a href="/events">Events</a>
          <a href="/now-playing">Now Playing</a>
          <a href="/admin">Admin</a>
        </nav>
      </div>
    </header>
  );
}

export default Header;
