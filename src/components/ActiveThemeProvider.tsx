// src/components/ActiveThemeProvider.tsx
// createContext is a client-only React API — it can't live in theme.ts,
// since that file is also imported by server-only code (the /api/site-theme
// route, getActiveThemeServer.ts). Kept here instead: the root layout (a
// Server Component) fetches the real theme and passes it in as a prop,
// this Client Component puts it on the context, and useActiveTheme reads
// it back out — so every page gets the real theme on its first render
// instead of starting on DEFAULT_THEME and flashing once a client fetch
// resolves.

"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_THEME, THEMES, type ThemeTokens } from "src/lib/theme";

const ActiveThemeContext = createContext<ThemeTokens>(THEMES[DEFAULT_THEME]);

export function ActiveThemeProvider({ theme, children }: { theme: ThemeTokens; children: ReactNode }) {
  return <ActiveThemeContext.Provider value={theme}>{children}</ActiveThemeContext.Provider>;
}

export function useActiveThemeTokens(): ThemeTokens {
  return useContext(ActiveThemeContext);
}
