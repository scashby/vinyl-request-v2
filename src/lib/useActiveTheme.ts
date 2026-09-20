// src/lib/useActiveTheme.ts
// Shared client-side hook for reading the active site theme. The real
// theme is resolved server-side once, in the root layout, and provided via
// ActiveThemeContext — this hook just reads it, so every page/component
// gets the correct theme on its first render instead of starting on
// DEFAULT_THEME and re-rendering once a client fetch resolves (that
// start-wrong-then-swap was a visible flash on every page load).

import { useActiveThemeTokens } from 'src/components/ActiveThemeProvider';
import { toCssVars } from 'src/lib/theme';

export function useActiveTheme() {
  const theme = useActiveThemeTokens();
  return { theme, themeName: theme.name, cssVars: toCssVars(theme) as React.CSSProperties };
}
