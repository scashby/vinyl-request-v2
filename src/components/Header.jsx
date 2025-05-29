import { useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function Header() {
  const location = useLocation();
  const [theme, setTheme] = useState('record-bar.css');

  useEffect(() => {
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const existing = document.getElementById('theme-style');
    if (existing) {
      existing.remove();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'theme-style';
    link.href = '/' + theme;
    document.head.appendChild(link);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    console.log(`🎨 Theme change requested: ${newTheme}`);
    setTheme(newTheme);
    localStorage.setItem('selectedTheme', newTheme);
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