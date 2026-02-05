// src/app/edit-collection/pickers/pickerDataUtils.ts
'use client';

import { supabase } from "../../../lib/supabaseClient";

export interface PickerDataItem {
  id: string;
  name: string;
  count?: number;
  sortName?: string;
}


// Sorting helper for Grades (Mint -> Poor)
const GRADE_RANKS: Record<string, number> = {
  'Sealed': 0,
  'Mint (M)': 1,
  'Near Mint (NM or M-)': 2,
  'Very Good Plus (VG+)': 3,
  'Very Good (VG)': 4,
  'Good Plus (G+)': 5,
  'Good (G)': 6,
  'Fair (F)': 7,
  'Poor (P)': 8,
  'Generic': 9,
  'No Cover': 10
};

function getGradeRank(name: string): number {
  return GRADE_RANKS[name] ?? 99; // Unknown grades go to the bottom
}

// ============================================================================
// READ OPERATIONS (V3 SCHEMA ONLY)
// ============================================================================

export async function fetchLabels(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('releases')
      .select('label')
      .not('label', 'is', null)
      .not('label', 'eq', '');
    if (error) return [];

    const labelCounts = new Map<string, number>();
    data?.forEach(row => {
      if (row.label) labelCounts.set(row.label, (labelCounts.get(row.label) || 0) + 1);
    });
    return Array.from(labelCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function updateLabel(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('releases').update({ label: newName }).eq('label', id); return !error; } catch { return false; }
}

export async function deleteLabel(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('releases').update({ label: null }).eq('label', id); return !error; } catch { return false; }
}

export async function mergeLabels(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('releases').update({ label: targetId }).in('label', sourceIds); return !error; } catch { return false; }
}

export async function fetchFormats(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('releases')
      .select('media_type, format_details')
      .not('media_type', 'is', null);
    if (error) return [];
    const formatCounts = new Map<string, number>();
    data?.forEach(row => {
      const values = new Set<string>();
      if (row.media_type) values.add(row.media_type);
      if (Array.isArray(row.format_details)) {
        row.format_details.forEach(detail => { if (detail) values.add(detail); });
      }
      values.forEach(value => formatCounts.set(value, (formatCounts.get(value) || 0) + 1));
    });
    return Array.from(formatCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchGenres(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('masters')
      .select('genres')
      .not('genres', 'is', null);
    if (error) return [];
    const genreCounts = new Map<string, number>();
    data?.forEach(row => {
      const allGenres = Array.isArray(row.genres) ? row.genres : [];
      allGenres.forEach(genre => { if (genre) genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1); });
    });
    return Array.from(genreCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchLocations(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('location')
      .not('location', 'is', null)
      .not('location', 'eq', '');
    if (error) return [];
    const locationCounts = new Map<string, number>();
    data?.forEach(row => { if (row.location) locationCounts.set(row.location, (locationCounts.get(row.location) || 0) + 1); });
    return Array.from(locationCounts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchArtists(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('artists')
      .select('name')
      .not('name', 'is', null)
      .not('name', 'eq', '');
    if (error) return [];
    const artistMap = new Map<string, number>();
    data?.forEach(row => {
      if (row.name) {
        artistMap.set(row.name, (artistMap.get(row.name) || 0) + 1);
      }
    });
    return Array.from(artistMap.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

export async function fetchMediaConditions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('media_condition')
      .not('media_condition', 'is', null)
      .not('media_condition', 'eq', '');

    if (error) return [];

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.media_condition) {
        counts.set(row.media_condition, (counts.get(row.media_condition) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => {
        const rankA = getGradeRank(a.name);
        const rankB = getGradeRank(b.name);
        if (rankA === rankB) return a.name.localeCompare(b.name);
        return rankA - rankB;
      });
  } catch {
    return [];
  }
}

export async function fetchPackageConditions(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('sleeve_condition')
      .not('sleeve_condition', 'is', null)
      .not('sleeve_condition', 'eq', '');

    if (error) return [];

    const counts = new Map<string, number>();
    data?.forEach(row => {
      if (row.sleeve_condition) {
        counts.set(row.sleeve_condition, (counts.get(row.sleeve_condition) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => {
        const rankA = getGradeRank(a.name);
        const rankB = getGradeRank(b.name);
        if (rankA === rankB) return a.name.localeCompare(b.name);
        return rankA - rankB;
      });
  } catch {
    return [];
  }
}

export async function fetchCountries(): Promise<PickerDataItem[]> {
  const standardCountries = ['US', 'UK', 'Canada', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Austria', 'Switzerland', 'Japan', 'Australia', 'New Zealand', 'Brazil', 'Mexico', 'Argentina', 'Russia', 'Poland', 'Czech Republic', 'Hungary', 'Portugal', 'Greece', 'Ireland', 'Israel', 'South Korea', 'China', 'India', 'Europe', 'UK & Europe', 'USA & Canada'];
  try {
    const { data, error } = await supabase
      .from('releases')
      .select('country')
      .not('country', 'is', null)
      .not('country', 'eq', '');
    if (error) throw error;
    const countryCounts = new Map<string, number>();
    data?.forEach(row => { if (row.country) countryCounts.set(row.country, (countryCounts.get(row.country) || 0) + 1); });
    const allCountries = new Set([...standardCountries, ...countryCounts.keys()]);
    return Array.from(allCountries)
      .map(name => ({ id: name, name, count: countryCounts.get(name) || 0 }))
      .sort((a, b) => (a.name === 'US' ? -1 : b.name === 'US' ? 1 : a.name.localeCompare(b.name)));
  } catch {
    return standardCountries.map(name => ({ id: name, name, count: 0 }))
      .sort((a, b) => (a.name === 'US' ? -1 : b.name === 'US' ? 1 : a.name.localeCompare(b.name)));
  }
}

export async function fetchOwners(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase.from('inventory').select('owner').not('owner', 'is', null).not('owner', 'eq', '');
    if (error) return [];
    const counts = new Map<string, number>();
    data?.forEach(row => { if (row.owner) counts.set(row.owner, (counts.get(row.owner) || 0) + 1); });
    return Array.from(counts.entries()).map(([name, count]) => ({ id: name, name, count })).sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

// Tags (Master Tags)
export async function fetchTags(): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('master_tag_links')
      .select('tag_id, master_tags (name)');
    if (error) return [];

    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      const name = (row as unknown as { master_tags?: { name?: string | null } | null }).master_tags?.name;
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// ============================================================================
// WRITE OPERATIONS (V3 SCHEMA ONLY)
// ============================================================================

export async function updateLocation(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: newName }).eq('location', id); return !error; } catch { return false; }
}

export async function deleteLocation(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: null }).eq('location', id); return !error; } catch { return false; }
}

export async function mergeLocations(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ location: targetId }).in('location', sourceIds); return !error; } catch { return false; }
}

export async function updateArtist(id: string, newName: string): Promise<boolean> {
  try {
    const updates: { name: string } = { name: newName };
    const { error } = await supabase.from('artists').update(updates).eq('name', id);
    return !error;
  } catch { return false; }
}

export async function deleteArtist(id: string): Promise<boolean> {
  try {
    const { data: artist, error: fetchError } = await supabase
      .from('artists')
      .select('id')
      .eq('name', id)
      .maybeSingle();
    if (fetchError || !artist) return false;

    const { count, error: countError } = await supabase
      .from('masters')
      .select('id', { count: 'exact', head: true })
      .eq('main_artist_id', artist.id);
    if (countError) return false;
    if ((count ?? 0) > 0) return false;

    const { error: deleteError } = await supabase
      .from('artists')
      .delete()
      .eq('id', artist.id);
    return !deleteError;
  } catch { return false; }
}

export async function mergeArtists(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    const { data: targetArtist, error: targetError } = await supabase
      .from('artists')
      .select('id')
      .eq('name', targetId)
      .maybeSingle();
    if (targetError || !targetArtist) return false;

    if (!sourceIds.length) return true;
    const { data: sourceArtists, error: sourceError } = await supabase
      .from('artists')
      .select('id, name')
      .in('name', sourceIds);
    if (sourceError) return false;
    const sourceArtistIds = (sourceArtists ?? []).map(row => row.id).filter((idVal) => idVal !== targetArtist.id);
    if (!sourceArtistIds.length) return true;

    const { error: updateError } = await supabase
      .from('masters')
      .update({ main_artist_id: targetArtist.id })
      .in('main_artist_id', sourceArtistIds);
    if (updateError) return false;

    await supabase.from('artists').delete().in('id', sourceArtistIds);
    return true;
  } catch { return false; }
}

const replaceFormatValues = (values: string[] | null | undefined, targetId: string, sourceIds: string[]) => {
  if (!Array.isArray(values) || values.length === 0) return values ?? null;
  const sources = new Set(sourceIds);
  const replaced = values.map(value => (sources.has(value) ? targetId : value));
  const deduped: string[] = [];
  replaced.forEach(value => {
    if (!deduped.includes(value)) deduped.push(value);
  });
  return deduped;
};

export async function updateFormat(id: string, newName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('releases')
      .select('id, media_type, format_details')
      .or(`media_type.eq.${id},format_details.cs.{${id}}`);
    if (error) return false;
    const rows = data ?? [];
    if (!rows.length) return true;

    const updates = rows.map(row => {
      const mediaType = row.media_type === id ? newName : row.media_type;
      const formatDetails = replaceFormatValues(row.format_details ?? null, newName, [id]);
      const payload: { media_type?: string | null; format_details?: string[] | null } = {};
      if (mediaType !== row.media_type) payload.media_type = mediaType;
      if (formatDetails !== row.format_details) payload.format_details = formatDetails ?? null;
      if (!Object.keys(payload).length) return Promise.resolve(null);
      return supabase.from('releases').update(payload).eq('id', row.id);
    });

    const results = await Promise.all(updates);
    return results.every(res => !res || !('error' in res) || !res.error);
  } catch { return false; }
}

export async function mergeFormats(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    if (!sourceIds.length) return true;
    const { data, error } = await supabase
      .from('releases')
      .select('id, media_type, format_details')
      .or([
        `media_type.in.(${sourceIds.map((val) => `"${val}"`).join(',')})`,
        `format_details.cs.{${sourceIds.join(',')}}`
      ].join(','));
    if (error) return false;
    const rows = data ?? [];
    if (!rows.length) return true;

    const updates = rows.map(row => {
      const mediaType = sourceIds.includes(row.media_type ?? '') ? targetId : row.media_type;
      const formatDetails = replaceFormatValues(row.format_details ?? null, targetId, sourceIds);
      const payload: { media_type?: string | null; format_details?: string[] | null } = {};
      if (mediaType !== row.media_type) payload.media_type = mediaType;
      if (formatDetails !== row.format_details) payload.format_details = formatDetails ?? null;
      if (!Object.keys(payload).length) return Promise.resolve(null);
      return supabase.from('releases').update(payload).eq('id', row.id);
    });

    const results = await Promise.all(updates);
    return results.every(res => !res || !('error' in res) || !res.error);
  } catch { return false; }
}

export async function updateOwner(id: string, newName: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ owner: newName }).eq('owner', id); return !error; } catch { return false; }
}

export async function deleteOwner(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ owner: null }).eq('owner', id); return !error; } catch { return false; }
}

export async function mergeOwners(targetId: string, sourceIds: string[]): Promise<boolean> {
  try { const { error } = await supabase.from('inventory').update({ owner: targetId }).in('owner', sourceIds); return !error; } catch { return false; }
}

// Tags management (Master Tags)
export async function mergeTags(targetId: string, sourceIds: string[]): Promise<boolean> {
  try {
    if (!sourceIds.length) return true;
    const { data: target, error: targetError } = await supabase
      .from('master_tags')
      .select('id')
      .eq('name', targetId)
      .maybeSingle();
    if (targetError || !target) return false;

    const { data: sources, error: sourceError } = await supabase
      .from('master_tags')
      .select('id, name')
      .in('name', sourceIds);
    if (sourceError) return false;

    const sourceIdsToMerge = (sources ?? []).map(s => s.id).filter((id) => id !== target.id);
    if (!sourceIdsToMerge.length) return true;

    await supabase
      .from('master_tag_links')
      .update({ tag_id: target.id })
      .in('tag_id', sourceIdsToMerge);

    await supabase.from('master_tags').delete().in('id', sourceIdsToMerge);
    return true;
  } catch { return false; }
}

export async function renameTag(oldName: string, newName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('master_tags')
      .update({ name: newName })
      .eq('name', oldName);
    return !error;
  } catch { return false; }
}

export async function deleteTag(name: string): Promise<boolean> {
  try {
    const { data: tag, error: tagError } = await supabase
      .from('master_tags')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    if (tagError || !tag) return false;

    await supabase.from('master_tag_links').delete().eq('tag_id', tag.id);
    const { error } = await supabase.from('master_tags').delete().eq('id', tag.id);
    return !error;
  } catch { return false; }
}

export async function createTag(name: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('master_tags').insert({ name });
    return !error;
  } catch { return false; }
}

// ============================================================================
// Credits / Classical lists (derived from recordings.credits JSONB)
// ============================================================================

const asStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const extractCreditValues = (credits: unknown, key: string): string[] => {
  if (!credits || typeof credits !== 'object') return [];
  const record = credits as Record<string, unknown>;
  const direct = asStringArray(record[key]);
  const fromPeople = record.album_people && typeof record.album_people === 'object'
    ? asStringArray((record.album_people as Record<string, unknown>)[key])
    : [];
  const fromClassical = record.classical && typeof record.classical === 'object'
    ? asStringArray((record.classical as Record<string, unknown>)[key])
    : [];
  return Array.from(new Set([...direct, ...fromPeople, ...fromClassical]));
};

const extractAlbumDetailValues = (credits: unknown, key: string): string[] => {
  if (!credits || typeof credits !== 'object') return [];
  const record = credits as Record<string, unknown>;
  const details = (record.album_details ?? record.albumDetails ?? record.album_metadata) as Record<string, unknown> | undefined;
  if (!details || typeof details !== 'object') return [];
  return asStringArray(details[key]);
};

const setAlbumDetailsList = (credits: unknown, key: string, values: string[]) => {
  const base = (typeof credits === 'object' && credits !== null && !Array.isArray(credits))
    ? { ...(credits as Record<string, unknown>) }
    : {};
  const details = (typeof base.album_details === 'object' && base.album_details !== null && !Array.isArray(base.album_details))
    ? { ...(base.album_details as Record<string, unknown>) }
    : {};
  details[key] = unique(values);
  base.album_details = details;
  return base;
};

const updateAlbumDetailsFieldName = async (key: string, oldName: string, newName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractAlbumDetailValues(row.credits, key);
      if (!existing.includes(oldName)) return null;
      const nextValues = unique(existing.map((entry) => (entry === oldName ? newName : entry)));
      return { id: row.id, credits: setAlbumDetailsList(row.credits, key, nextValues) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

const deleteAlbumDetailsFieldName = async (key: string, nameToDelete: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractAlbumDetailValues(row.credits, key);
      if (!existing.includes(nameToDelete)) return null;
      const nextValues = unique(existing.filter((entry) => entry !== nameToDelete));
      return { id: row.id, credits: setAlbumDetailsList(row.credits, key, nextValues) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

const mergeAlbumDetailsFieldName = async (key: string, targetId: string, sourceIds: string[]): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractAlbumDetailValues(row.credits, key);
      const updated = existing.map((entry) => (sourceIds.includes(entry) ? targetId : entry));
      if (existing.join('|') === updated.join('|')) return null;
      return { id: row.id, credits: setAlbumDetailsList(row.credits, key, updated) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

const fetchAlbumDetailsList = async (key: string): Promise<PickerDataItem[]> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('credits')
      .not('credits', 'is', null);

    if (error) return [];

    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      const values = extractAlbumDetailValues(row.credits, key);
      values.forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};

async function fetchCreditsList(key: string): Promise<PickerDataItem[]> {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('credits')
      .not('credits', 'is', null);

    if (error) return [];

    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      const values = extractCreditValues(row.credits, key);
      values.forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function fetchComposers(): Promise<PickerDataItem[]> { return fetchCreditsList('composer'); }
export async function fetchConductors(): Promise<PickerDataItem[]> { return fetchCreditsList('conductor'); }
export async function fetchChoruses(): Promise<PickerDataItem[]> { return fetchCreditsList('chorus'); }
export async function fetchCompositions(): Promise<PickerDataItem[]> { return fetchCreditsList('composition'); }
export async function fetchOrchestras(): Promise<PickerDataItem[]> { return fetchCreditsList('orchestra'); }
export async function fetchSongwriters(): Promise<PickerDataItem[]> { return fetchCreditsList('songwriters'); }
export async function fetchProducers(): Promise<PickerDataItem[]> { return fetchCreditsList('producers'); }
export async function fetchEngineers(): Promise<PickerDataItem[]> { return fetchCreditsList('engineers'); }
export async function fetchMusicians(): Promise<PickerDataItem[]> { return fetchCreditsList('musicians'); }

// ============================================================================
// Legacy tab compatibility helpers (mapped to V3 sources)
// ============================================================================

const fetchReleaseStringList = async (column: 'notes'): Promise<PickerDataItem[]> => {
  try {
    const { data, error } = await supabase
      .from('releases')
      .select(column)
      .not(column, 'is', null);
    if (error) return [];
    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      const value = (row[column] as string | null | undefined)?.trim();
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};

export async function fetchStorageDevices(): Promise<PickerDataItem[]> {
  try {
    const locations = await fetchLocations();
    const counts = new Map<string, number>();
    locations.forEach((item) => {
      const first = item.name.split(/\s+/)[0]?.trim();
      if (!first) return;
      counts.set(first, (counts.get(first) || 0) + (item.count ?? 0));
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function fetchPackaging(): Promise<PickerDataItem[]> {
  const [detailValues, formatValues] = await Promise.all([
    fetchAlbumDetailsList('packaging'),
    fetchFormats(),
  ]);
  const map = new Map<string, PickerDataItem>();
  detailValues.forEach((item) => map.set(item.name, item));
  formatValues.forEach((item) => {
    if (!map.has(item.name)) map.set(item.name, item);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchStudios(): Promise<PickerDataItem[]> {
  const [detailValues, noteValues] = await Promise.all([
    fetchAlbumDetailsList('studio'),
    fetchReleaseStringList('notes'),
  ]);
  const map = new Map<string, PickerDataItem>();
  detailValues.forEach((item) => map.set(item.name, item));
  noteValues.forEach((item) => {
    if (!map.has(item.name)) map.set(item.name, item);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSounds(): Promise<PickerDataItem[]> {
  const [detailValues, styleValues] = await Promise.all([
    fetchAlbumDetailsList('sound'),
    fetchStylesAsSounds(),
  ]);
  const map = new Map<string, PickerDataItem>();
  detailValues.forEach((item) => map.set(item.name, item));
  styleValues.forEach((item) => {
    if (!map.has(item.name)) map.set(item.name, item);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const fetchStylesAsSounds = async (): Promise<PickerDataItem[]> => {
  try {
    const { data, error } = await supabase.from('masters').select('styles').not('styles', 'is', null);
    if (error) return [];
    const counts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      (row.styles ?? []).forEach((style) => {
        if (!style) return;
        counts.set(style, (counts.get(style) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
};

export async function fetchVinylColors(): Promise<PickerDataItem[]> {
  const [detailValues, formatValues] = await Promise.all([
    fetchAlbumDetailsList('vinyl_color'),
    fetchFormats(),
  ]);
  const map = new Map<string, PickerDataItem>();
  detailValues.forEach((item) => map.set(item.name, item));
  formatValues.forEach((item) => {
    if (!map.has(item.name)) map.set(item.name, item);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchVinylWeights(): Promise<PickerDataItem[]> {
  const [detailValues, formatValues] = await Promise.all([
    fetchAlbumDetailsList('vinyl_weight'),
    fetchFormats(),
  ]);
  const map = new Map<string, PickerDataItem>();
  detailValues.forEach((item) => map.set(item.name, item));
  formatValues.forEach((item) => {
    if (!map.has(item.name)) map.set(item.name, item);
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSPARS(): Promise<PickerDataItem[]> {
  return fetchAlbumDetailsList('spars_code');
}

export async function fetchBoxSets(): Promise<PickerDataItem[]> {
  return fetchAlbumDetailsList('box_set');
}

export async function fetchPurchaseStores(): Promise<PickerDataItem[]> {
  return fetchAlbumDetailsList('purchase_store');
}

export async function fetchSignees(): Promise<PickerDataItem[]> {
  return fetchAlbumDetailsList('signed_by');
}

export async function updatePackaging(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('packaging', id, newName);
}

export async function updateStudio(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('studio', id, newName);
}

export async function updateSound(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('sound', id, newName);
}

export async function updateVinylColor(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('vinyl_color', id, newName);
}

export async function updateSPARS(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('spars_code', id, newName);
}

const unique = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean)));

const setCreditsList = (credits: unknown, key: string, values: string[]) => {
  const next = (typeof credits === 'object' && credits !== null)
    ? { ...(credits as Record<string, unknown>) }
    : {};
  next[key] = unique(values);
  return next;
};

const updateCreditsFieldName = async (key: string, oldName: string, newName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractCreditValues(row.credits, key);
      if (!existing.includes(oldName)) return null;
      const nextValues = unique(existing.map((entry) => (entry === oldName ? newName : entry)));
      return { id: row.id, credits: setCreditsList(row.credits, key, nextValues) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

const deleteCreditsFieldName = async (key: string, nameToDelete: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractCreditValues(row.credits, key);
      if (!existing.includes(nameToDelete)) return null;
      const nextValues = unique(existing.filter((entry) => entry !== nameToDelete));
      return { id: row.id, credits: setCreditsList(row.credits, key, nextValues) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

const mergeCreditsFieldNames = async (key: string, targetName: string, sourceNames: string[]): Promise<boolean> => {
  try {
    const sourceSet = new Set(sourceNames);
    if (!sourceSet.size) return true;

    const { data, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .not('credits', 'is', null);
    if (error) return false;

    const rows = (data ?? []).map((row) => {
      const existing = extractCreditValues(row.credits, key);
      if (!existing.some((entry) => sourceSet.has(entry))) return null;
      const nextValues = unique(
        existing
          .filter((entry) => !sourceSet.has(entry))
          .concat(targetName)
      );
      return { id: row.id, credits: setCreditsList(row.credits, key, nextValues) };
    }).filter(Boolean) as { id: number; credits: Record<string, unknown> }[];

    if (!rows.length) return true;
    const results = await Promise.all(
      rows.map((row) =>
        supabase
          .from('recordings')
          .update({ credits: row.credits as unknown as import('types/supabase').Json })
          .eq('id', row.id)
      )
    );
    return results.every((res) => !res.error);
  } catch {
    return false;
  }
};

export async function deletePackaging(id: string): Promise<boolean> {
  return deleteAlbumDetailsFieldName('packaging', id);
}

export async function mergePackaging(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('packaging', targetId, sourceIds);
}

export async function mergeVinylColors(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('vinyl_color', targetId, sourceIds);
}

export async function mergeSPARS(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('spars_code', targetId, sourceIds);
}

export async function updatePurchaseStore(id: string, newName: string): Promise<boolean> {
  return updateAlbumDetailsFieldName('purchase_store', id, newName);
}

export async function deletePurchaseStore(id: string): Promise<boolean> {
  return deleteAlbumDetailsFieldName('purchase_store', id);
}

export async function mergePurchaseStores(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('purchase_store', targetId, sourceIds);
}

export async function mergeStudios(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('studio', targetId, sourceIds);
}

export async function mergeSounds(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeAlbumDetailsFieldName('sound', targetId, sourceIds);
}

export async function updateComposer(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('composer', id, newName);
}

export async function mergeComposers(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('composer', targetId, sourceIds);
}

export async function updateConductor(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('conductor', id, newName);
}

export async function mergeConductors(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('conductor', targetId, sourceIds);
}

export async function updateChorus(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('chorus', id, newName);
}

export async function mergeChorus(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('chorus', targetId, sourceIds);
}

export async function updateComposition(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('composition', id, newName);
}

export async function mergeCompositions(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('composition', targetId, sourceIds);
}

export async function updateOrchestra(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('orchestra', id, newName);
}

export async function mergeOrchestras(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('orchestra', targetId, sourceIds);
}

export async function updateSongwriter(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('songwriters', id, newName);
}

export async function deleteSongwriter(id: string): Promise<boolean> {
  return deleteCreditsFieldName('songwriters', id);
}

export async function mergeSongwriters(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('songwriters', targetId, sourceIds);
}

export async function updateProducer(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('producers', id, newName);
}

export async function deleteProducer(id: string): Promise<boolean> {
  return deleteCreditsFieldName('producers', id);
}

export async function mergeProducers(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('producers', targetId, sourceIds);
}

export async function updateEngineer(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('engineers', id, newName);
}

export async function deleteEngineer(id: string): Promise<boolean> {
  return deleteCreditsFieldName('engineers', id);
}

export async function mergeEngineers(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('engineers', targetId, sourceIds);
}

export async function updateMusician(id: string, newName: string): Promise<boolean> {
  return updateCreditsFieldName('musicians', id, newName);
}

export async function deleteMusician(id: string): Promise<boolean> {
  return deleteCreditsFieldName('musicians', id);
}

export async function mergeMusicians(targetId: string, sourceIds: string[]): Promise<boolean> {
  return mergeCreditsFieldNames('musicians', targetId, sourceIds);
}
// AUDIT: inspected, no changes.
