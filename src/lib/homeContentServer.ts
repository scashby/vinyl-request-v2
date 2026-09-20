// src/lib/homeContentServer.ts
// Server-side counterpart to the /api/homepage-sections GET route (same
// query, same table) — lets the homepage resolve its own marketing copy
// server-side (see src/app/page.tsx) instead of starting on
// DEFAULT_SECTIONS and swapping to the real copy once a client fetch
// resolves after mount, which was a visible flash on every page load.

import { supabase } from 'src/lib/supabaseClient';
import { resolveSections, type HomepageSection } from 'src/lib/homeContent';

export async function getResolvedHomeSections(page: string) {
  const { data, error } = await supabase
    .from('homepage_sections')
    .select('*')
    .eq('page', page)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching homepage sections (server):', error);
    return resolveSections(null);
  }

  return resolveSections(data as HomepageSection<Record<string, unknown>>[]);
}
