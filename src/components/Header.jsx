import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem('selectedTheme');
    const link = document.getElementById('theme-link');
    if (saved && link) {
      link.href = '/' + saved;
    }
  }, []);

  const handleThemeChange = (theme) => {
    const link = document.getElementById('theme-link');
    if (link) {
      link.href = '/' + theme;
      localStorage.setItem('selectedTheme', theme);
    }
  };

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
      <div className="theme-buttons" style={{ marginTop: '1rem' }}>
        <button onClick={() => handleThemeChange('record-bar.css')}>🎷 Bar</button>
        <button onClick={() => handleThemeChange('vinyl-stack.css')}>💿 Stack</button>
        <button onClick={() => handleThemeChange('midnight-lounge.css')}>🌃 Lounge</button>
        <button onClick={() => handleThemeChange('indie-label.css')}>🧷 Indie</button>
      </div>
    </header>
  );
}