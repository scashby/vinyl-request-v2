// src/lib/customTrackWorkflow.ts
//
// Creates a "virtual" inventory chain (artist -> master -> release ->
// release_track/recording -> inventory) for a track the user wants to add
// that isn't backed by a real owned release (e.g. a song from a custom mix
// tape/CD). Flagged via masters.is_custom / releases.is_custom so it can
// never collide with a real getOrCreate lookup elsewhere, and so downstream
// consumers can filter it out later if needed.
//
// Modeled on the getOrCreate chain in clzImportWorkflow.ts.

import type { SupabaseClient } from '@supabase/supabase-js';

export type CustomTrackInput = {
  title: string;
  artist?: string;
  album?: string;
};

export type CustomTrackResult = {
  trackKey: string;
  inventoryId: number;
  releaseId: number;
  masterId: number;
  artistId: number;
};

const normalizeText = (value?: string | null) => (value ?? '').trim();

async function getOrCreateArtist(
  supabase: SupabaseClient,
  name: string
): Promise<number> {
  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('artists')
    .insert({ name })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created.id;
}

async function getOrCreateCustomMaster(
  supabase: SupabaseClient,
  artistId: number,
  title: string
): Promise<number> {
  const { data: existing } = await supabase
    .from('masters')
    .select('id')
    .ilike('title', title)
    .eq('main_artist_id', artistId)
    .eq('is_custom', true)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('masters')
    .insert({ title, main_artist_id: artistId, is_custom: true })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created.id;
}

async function getOrCreateCustomRelease(
  supabase: SupabaseClient,
  masterId: number
): Promise<number> {
  const { data: existing } = await supabase
    .from('releases')
    .select('id')
    .eq('master_id', masterId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('releases')
    .insert({ master_id: masterId, media_type: 'Custom', is_custom: true })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created.id;
}

async function getOrCreateInventoryForRelease(
  supabase: SupabaseClient,
  releaseId: number
): Promise<number> {
  const { data: existing } = await supabase
    .from('inventory')
    .select('id')
    .eq('release_id', releaseId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('inventory')
    .insert({ release_id: releaseId, status: 'active' })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created.id;
}

async function insertRecordingAndTrack(
  supabase: SupabaseClient,
  releaseId: number,
  title: string,
  artist?: string
): Promise<string> {
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .insert({ title, track_artist: normalizeText(artist) || null })
    .select('id')
    .single();

  if (recordingError || !recording) throw recordingError;

  const { data: lastTrack } = await supabase
    .from('release_tracks')
    .select('position')
    .eq('release_id', releaseId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastPosition = lastTrack?.position ? Number.parseInt(lastTrack.position, 10) : 0;
  const nextPosition = String((Number.isFinite(lastPosition) ? lastPosition : 0) + 1);

  const { error: trackError } = await supabase.from('release_tracks').insert({
    release_id: releaseId,
    recording_id: recording.id,
    position: nextPosition,
    side: null,
  });

  if (trackError) throw trackError;

  return nextPosition;
}

export async function createCustomTrack(
  supabase: SupabaseClient,
  input: CustomTrackInput
): Promise<CustomTrackResult> {
  const title = normalizeText(input.title);
  if (!title) throw new Error('title is required');

  const artistName = normalizeText(input.artist) || 'Unknown Artist';
  const groupTitle = normalizeText(input.album) || title;

  const artistId = await getOrCreateArtist(supabase, artistName);
  const masterId = await getOrCreateCustomMaster(supabase, artistId, groupTitle);
  const releaseId = await getOrCreateCustomRelease(supabase, masterId);
  const position = await insertRecordingAndTrack(supabase, releaseId, title, input.artist);
  const inventoryId = await getOrCreateInventoryForRelease(supabase, releaseId);

  return {
    trackKey: `${inventoryId}:${position}`,
    inventoryId,
    releaseId,
    masterId,
    artistId,
  };
}
