import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

  const navLink = (path, label) => (
    <a
      href={path}
      className={`nav-link ${location.pathname === path ? 'active' : ''}`}
    >
      {label}
    </a>
  );

  return (
    <header className="header-bar">
      <h1 className="site-title">Dead Wax Dialogues</h1>
      <nav className="nav-links">
        {navLink('/', 'Events')}
        {navLink('/browse', 'Browse')}
        {navLink('/now-playing', 'Now Playing')}
        {navLink('/admin', 'Admin')}
      </nav>
    </header>
  );
}