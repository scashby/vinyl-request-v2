// src/lib/getActiveThemeServer.ts
// Server-component counterpart to src/lib/useActiveTheme.ts — for pages
// that fetch their own data server-side (e.g. Games, which queries
// supabaseAdmin directly) rather than as client components. Kept in its
// own file (not theme.ts) so theme.ts — imported by client components —
// never pulls in the service-role Supabase client.

import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import { DEFAULT_THEME, THEMES, isThemeName, toCssVars, type ThemeTokens } from 'src/lib/theme';

export async function getActiveTheme(): Promise<ThemeTokens> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', 'theme:active')
      .maybeSingle();

    if (error) {
      console.error('Error fetching active theme (server):', error);
      return THEMES[DEFAULT_THEME];
    }

    const name = isThemeName(data?.value) ? data.value : DEFAULT_THEME;
    return THEMES[name];
  } catch (error) {
    console.error('Unexpected error fetching active theme (server):', error);
    return THEMES[DEFAULT_THEME];
  }
}

export { toCssVars };
