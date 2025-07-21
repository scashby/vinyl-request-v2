// src/lib/isTrackInCollection.ts

import { supabase } from 'lib/supabaseClient';

export async function isTrackInCollection(artist: string, title: string, album: string) {
  const { data, error } = await supabase
    .from('album_context')
    .select('*')
    .ilike('artist', artist)
    .ilike('title', title)
    .ilike('album', album);

  if (error) {
    console.error('Supabase error:', error);
    return false;
  }

  return data.length > 0;
}
