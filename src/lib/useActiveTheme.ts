// src/lib/useActiveTheme.ts
// Shared client-side hook for fetching the active site theme. Used by the
// homepage, nav, footer, and now About/Dialogues/Merch — previously each
// component duplicated this fetch-and-fallback logic individually.

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEMES, isThemeName, toCssVars, type ThemeName } from 'src/lib/theme';

export function useActiveTheme() {
  const [themeName, setThemeName] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    fetch('/api/site-theme')
      .then((res) => res.json())
      .then((data) => {
        if (isThemeName(data?.theme)) setThemeName(data.theme);
      })
      .catch((err) => console.error('Error loading active theme:', err));
  }, []);

  const theme = THEMES[themeName];
  return { theme, themeName, cssVars: toCssVars(theme) as React.CSSProperties };
}
