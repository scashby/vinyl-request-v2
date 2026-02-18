// src/app/api/enrich-sources/genius/route.ts - FIXED with proper matching validation
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;
const KSOFT_API_KEY = process.env.KSOFT_API_KEY || process.env.KSOFT_API_TOKEN || '';
const ONEMUSIC_API_KEY = process.env.ONEMUSIC_API_KEY || process.env.ONE_MUSIC_API_KEY || '';
const LYRICS_PROVIDERS = ['genius', 'lrclib', 'lyricsovh', 'ksoft', 'onemusicapi'] as const;
type LyricsProvider = (typeof LYRICS_PROVIDERS)[number];

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

type Track = {
  position?: string;
  title?: string;
  recording_id?: number | null;
  lyrics_url?: string | null;
  lyrics?: string | null;
  track_artist?: string | null;
  credits?: Record<string, unknown> | null;
};

const normalizeCredits = (credits: unknown) => {
  if (!credits || typeof credits !== 'object' || Array.isArray(credits)) return {};
  return credits as Record<string, unknown>;
};

function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function simplifyTrackTitle(title: string): string {
  return title
    .replace(/\((feat|featuring|ft)\.?.*?\)/gi, '')
    .replace(/\[(feat|featuring|ft)\.?.*?\]/gi, '')
    .replace(/\((remaster(ed)?|mono|stereo|live|edit|version).*?\)/gi, '')
    .replace(/\[(remaster(ed)?|mono|stereo|live|edit|version).*?\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTitleVariants(title: string): string[] {
  const base = simplifyTrackTitle(title);
  const variants = new Set<string>([title.trim(), base]);
  variants.add(base.replace(/['"`]/g, ''));
  variants.add(base.replace(/\b(pt|part)\.?\s*\d+\b/gi, '').trim());
  variants.add(base.replace(/\b(vol|volume)\.?\s*\d+\b/gi, '').trim());
  return Array.from(variants).map((v) => v.trim()).filter((v) => v.length > 0);
}

function buildArtistVariants(albumArtist: string, trackArtist?: string | null): string[] {
  const variants = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    variants.add(trimmed);
    variants.add(trimmed.split(',')[0].trim());
    variants.add(trimmed.split('&')[0].trim());
    variants.add(trimmed.replace(/\b(feat|featuring|ft)\.?.*$/i, '').trim());
  };
  add(albumArtist);
  add(trackArtist);
  return Array.from(variants).filter((v) => v.length > 0);
}

function isGoodMatch(searchArtist: string, searchTrack: string, resultArtist: string, resultTrack: string): boolean {
  const normSearchArtist = normalizeForMatch(searchArtist);
  const normSearchTrack = normalizeForMatch(searchTrack);
  const normResultArtist = normalizeForMatch(resultArtist);
  const normResultTrack = normalizeForMatch(resultTrack);

  // Artist must match (exact or one contains the other)
  const artistMatch = 
    normSearchArtist === normResultArtist ||
    normSearchArtist.includes(normResultArtist) ||
    normResultArtist.includes(normSearchArtist);

  if (!artistMatch) {
    console.log(`    ❌ Artist mismatch: "${searchArtist}" vs "${resultArtist}"`);
    return false;
  }

  // Track title must match (exact or one contains the other)
  const trackMatch = 
    normSearchTrack === normResultTrack ||
    normSearchTrack.includes(normResultTrack) ||
    normResultTrack.includes(normSearchTrack);

  if (!trackMatch) {
    console.log(`    ❌ Track mismatch: "${searchTrack}" vs "${resultTrack}"`);
    return false;
  }

  console.log(`    ✅ Good match: "${resultArtist}" - "${resultTrack}"`);
  return true;
}

async function searchLyrics(albumArtist: string, trackTitle: string): Promise<string | null> {
  if (!GENIUS_TOKEN) {
    throw new Error('Genius token not configured');
  }

  const query = encodeURIComponent(`${albumArtist} ${trackTitle}`);
  console.log(`    → Searching Genius: "${albumArtist}" - "${trackTitle}"`);
  
  const searchRes = await fetch(`https://api.genius.com/search?q=${query}`, {
    headers: { 'Authorization': `Bearer ${GENIUS_TOKEN}` }
  });

  if (!searchRes.ok) {
    console.log(`    → Genius search failed: HTTP ${searchRes.status}`);
    throw new Error(`Genius API returned ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const hits = searchData?.response?.hits || [];

  if (hits.length === 0) {
    console.log(`    → No Genius results found`);
    return null;
  }

  console.log(`    → Got ${hits.length} search results, validating...`);

  // Check each result until we find a good match
  for (const hit of hits) {
    const result = hit.result;
    if (!result) continue;

    const resultArtist = result.primary_artist?.name || result.artist_names || '';
    const resultTrack = result.title || '';
    const url = result.url;

    console.log(`    🔍 Checking: "${resultArtist}" - "${resultTrack}"`);

    if (isGoodMatch(albumArtist, trackTitle, resultArtist, resultTrack)) {
      console.log(`    ✅ Found validated match: ${url}`);
      return url;
    }
  }

  console.log(`    ❌ No validated matches found among ${hits.length} results`);
  return null;
}

async function searchLrcLibLyrics(albumArtist: string, trackTitle: string): Promise<string | null> {
  const cleanTitle = simplifyTrackTitle(trackTitle);
  const params = new URLSearchParams({
    track_name: cleanTitle || trackTitle,
    artist_name: albumArtist
  });
  const apiUrl = `https://lrclib.net/api/search?${params.toString()}`;
  console.log(`    → Searching LRCLIB: "${albumArtist}" - "${cleanTitle || trackTitle}"`);

  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'DeadWaxDialogues/1.0 (+lyrics enrichment)' }
  });

  if (!res.ok) {
    throw new Error(`LRCLIB returned ${res.status}`);
  }

  const data = await res.json();
  const entries = Array.isArray(data) ? data : [];
  if (entries.length === 0) {
    return null;
  }

  const normArtist = normalizeForMatch(albumArtist);
  const normTrack = normalizeForMatch(cleanTitle || trackTitle);

  const best = entries.find((entry: Record<string, unknown>) => {
    const entryArtist = normalizeForMatch(String(entry.artistName ?? ''));
    const entryTrack = normalizeForMatch(String(entry.trackName ?? ''));
    const artistMatch = entryArtist === normArtist || entryArtist.includes(normArtist) || normArtist.includes(entryArtist);
    const trackMatch = entryTrack === normTrack || entryTrack.includes(normTrack) || normTrack.includes(entryTrack);
    return artistMatch && trackMatch;
  }) || entries[0];

  const bestId = best && typeof best === 'object' ? (best as Record<string, unknown>).id : null;
  if (typeof bestId === 'number' || typeof bestId === 'string') {
    return `https://lrclib.net/api/get/${bestId}`;
  }

  return apiUrl;
}

type LyricsLookupResult = {
  lyricsUrl?: string | null;
  lyricsText?: string | null;
  source: string;
};

const cleanLyricsText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
};

async function searchLrcLib(albumArtist: string, trackTitle: string): Promise<LyricsLookupResult | null> {
  const cleanTitle = simplifyTrackTitle(trackTitle);
  const params = new URLSearchParams({
    track_name: cleanTitle || trackTitle,
    artist_name: albumArtist
  });
  const apiUrl = `https://lrclib.net/api/search?${params.toString()}`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'DeadWaxDialogues/1.0 (+lyrics enrichment)' }
  });
  if (!res.ok) throw new Error(`LRCLIB returned ${res.status}`);
  const data = await res.json();
  const entries = Array.isArray(data) ? data : [];
  if (entries.length === 0) return null;

  const normArtist = normalizeForMatch(albumArtist);
  const normTrack = normalizeForMatch(cleanTitle || trackTitle);
  const best = entries.find((entry: Record<string, unknown>) => {
    const entryArtist = normalizeForMatch(String(entry.artistName ?? ''));
    const entryTrack = normalizeForMatch(String(entry.trackName ?? ''));
    const artistMatch = entryArtist === normArtist || entryArtist.includes(normArtist) || normArtist.includes(entryArtist);
    const trackMatch = entryTrack === normTrack || entryTrack.includes(normTrack) || normTrack.includes(entryTrack);
    return artistMatch && trackMatch;
  }) || entries[0];

  const bestObj = (best && typeof best === 'object') ? best as Record<string, unknown> : {};
  const plain = cleanLyricsText(bestObj.plainLyrics);
  const synced = cleanLyricsText(bestObj.syncedLyrics);
  const lyricsText = plain || synced;
  const bestId = bestObj.id;
  const lyricsUrl = (typeof bestId === 'number' || typeof bestId === 'string')
    ? `https://lrclib.net/api/get/${bestId}`
    : apiUrl;

  return { source: 'lrclib', lyricsUrl, lyricsText };
}

async function searchLyricsOvh(albumArtist: string, trackTitle: string): Promise<LyricsLookupResult | null> {
  const artist = albumArtist.trim();
  const title = simplifyTrackTitle(trackTitle) || trackTitle;
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DeadWaxDialogues/1.0 (+lyrics enrichment)' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lyrics.ovh returned ${res.status}`);
  const data = await res.json();
  const lyricsText = cleanLyricsText(data?.lyrics);
  if (!lyricsText) return null;
  return { source: 'lyricsovh', lyricsUrl: null, lyricsText };
}

async function searchKSoftLyrics(albumArtist: string, trackTitle: string): Promise<LyricsLookupResult | null> {
  if (!KSOFT_API_KEY) return null;
  const query = encodeURIComponent(`${albumArtist} ${simplifyTrackTitle(trackTitle) || trackTitle}`);
  const url = `https://api.ksoft.si/lyrics/search?q=${query}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${KSOFT_API_KEY}`,
      'User-Agent': 'DeadWaxDialogues/1.0 (+lyrics enrichment)'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KSoft returned ${res.status}`);
  const data = await res.json();
  const payload = Array.isArray(data?.data) ? data.data[0] : (data?.data || data);
  const lyricsText = cleanLyricsText(payload?.lyrics || payload?.text);
  const lyricsUrl = cleanLyricsText(payload?.url || payload?.source || payload?.link);
  if (!lyricsText) return null;
  return { source: 'ksoft', lyricsUrl, lyricsText };
}

async function searchOneMusicLyrics(albumArtist: string, trackTitle: string): Promise<LyricsLookupResult | null> {
  if (!ONEMUSIC_API_KEY) return null;
  const query = encodeURIComponent(`${albumArtist} ${simplifyTrackTitle(trackTitle) || trackTitle}`);
  const url = `http://api.onemusicapi.com/lyric/?apikey=${encodeURIComponent(ONEMUSIC_API_KEY)}&q=${query}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DeadWaxDialogues/1.0 (+lyrics enrichment)' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneMusicAPI returned ${res.status}`);
  const data = await res.json();
  const payload = Array.isArray(data) ? data[0] : (data?.result || data?.data || data);
  const lyricsText = cleanLyricsText(payload?.lyrics || payload?.text);
  const lyricsUrl = cleanLyricsText(payload?.url || payload?.source || payload?.link);
  if (!lyricsText) return null;
  return { source: 'onemusicapi', lyricsUrl, lyricsText };
}

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json();
    const { albumId, providers } = body as { albumId?: number; providers?: unknown };
    const requestedProviders = Array.isArray(providers)
      ? providers.filter((value): value is LyricsProvider => typeof value === 'string' && (LYRICS_PROVIDERS as readonly string[]).includes(value))
      : [];
    const activeProviders: LyricsProvider[] = requestedProviders.length > 0 ? requestedProviders : [...LYRICS_PROVIDERS];

    console.log(`\n📝 === GENIUS LYRICS ENRICHMENT for Album ID: ${albumId} ===`);

    if (!albumId) {
      console.log('❌ ERROR: No albumId provided');
      return NextResponse.json({
        success: false,
        error: 'albumId required'
      }, { status: 400 });
    }

    const { data: album, error: dbError } = await supabase
      .from('inventory')
      .select(`
        id,
        release:releases (
          id,
          master:masters (
            title,
            artist:artists (name)
          ),
          release_tracks:release_tracks (
            position,
            recording_id,
            title_override,
            recording:recordings (
              id,
              title,
              track_artist,
              credits,
              lyrics_url,
              lyrics
            )
          )
        )
      `)
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    const release = toSingle(album.release);
    const master = toSingle(release?.master);
    const artistName = toSingle(master?.artist)?.name ?? 'Unknown Artist';
    const albumTitle = master?.title ?? 'Untitled';

    console.log(`✓ Album found: "${artistName}" - "${albumTitle}"`);

    const tracks: Track[] = (release?.release_tracks ?? []).map((track) => {
      const recording = toSingle(track.recording);
      return {
        position: track.position,
        title: track.title_override || recording?.title || '',
        recording_id: track.recording_id ?? recording?.id ?? null,
        lyrics_url: recording?.lyrics_url ?? null,
        lyrics: recording?.lyrics ?? null,
        track_artist: recording?.track_artist ?? null,
        credits: normalizeCredits(recording?.credits ?? null)
      };
    });

    if (!Array.isArray(tracks) || tracks.length === 0) {
      console.log('❌ ERROR: No tracklist found');
      return NextResponse.json({
        success: false,
        error: 'No tracklist found',
        data: {
          albumId: album.id,
          artist: artistName,
          title: albumTitle
        }
      });
    }

    console.log(`\n🔍 Processing ${tracks.length} tracks...`);
    const enrichedTracks: Track[] = [];
    let enrichedCount = 0;
    let syncedCount = 0;
    let skippedCount = 0;
    let skippedExistingCount = 0;
    let skippedNoTitleCount = 0;
    let attemptedCount = 0;
    let failedCount = 0;
    const enrichedTracksList = [];
    const failedTracksList = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      console.log(`\n  Track ${i + 1}/${tracks.length}: "${track.title || 'untitled'}"`);

      if (!track.title) {
        console.log(`    ⏭️ Skipping: No title`);
        enrichedTracks.push(track);
        skippedCount++;
        skippedNoTitleCount++;
        continue;
      }

      const existingLyricsUrl = cleanLyricsText(track.lyrics_url) || cleanLyricsText(track.credits?.lyrics_url);
      const existingLyricsText = cleanLyricsText(track.lyrics) || cleanLyricsText(track.credits?.lyrics);
      if (existingLyricsUrl && existingLyricsText) {
        console.log(`    ⏭️ Skipping: Already has lyrics + lyrics URL`);
        enrichedTracks.push(track);
        skippedCount++;
        skippedExistingCount++;
        continue;
      }

      try {
        attemptedCount++;
        let lyricsUrl: string | null = existingLyricsUrl ?? null;
        let lyricsText: string | null = existingLyricsText ?? null;
        let lyricsSource = cleanLyricsText(track.credits?.lyrics_source) || 'unknown';
        const providerErrors: string[] = [];
        const titleVariants = buildTitleVariants(track.title);
        const artistVariants = buildArtistVariants(artistName, track.track_artist);

        for (const artistVariant of artistVariants) {
          if (lyricsUrl && lyricsText) break;
          for (const titleVariant of titleVariants) {
            if (lyricsUrl && lyricsText) break;

            for (const provider of activeProviders) {
              if (lyricsUrl && lyricsText) break;
              try {
                if (provider === 'genius') {
                  if (!lyricsUrl) {
                    const geniusUrl = await searchLyrics(artistVariant, titleVariant);
                    if (geniusUrl) {
                      lyricsUrl = geniusUrl;
                      lyricsSource = 'genius';
                    }
                  }
                  continue;
                }

                if (provider === 'lrclib') {
                  if (!lyricsText || !lyricsUrl) {
                    const lrc = await searchLrcLib(artistVariant, titleVariant);
                    if (lrc) {
                      if (!lyricsUrl && lrc.lyricsUrl) lyricsUrl = lrc.lyricsUrl;
                      if (!lyricsText && lrc.lyricsText) lyricsText = lrc.lyricsText;
                      lyricsSource = lrc.source;
                    }
                  }
                  continue;
                }

                if (provider === 'lyricsovh') {
                  if (!lyricsText) {
                    const ovh = await searchLyricsOvh(artistVariant, titleVariant);
                    if (ovh?.lyricsText) {
                      lyricsText = ovh.lyricsText;
                      lyricsSource = ovh.source;
                    }
                  }
                  continue;
                }

                if (provider === 'ksoft') {
                  if (!lyricsText) {
                    const ksoft = await searchKSoftLyrics(artistVariant, titleVariant);
                    if (ksoft?.lyricsText) {
                      lyricsText = ksoft.lyricsText;
                      if (ksoft.lyricsUrl && !lyricsUrl) lyricsUrl = ksoft.lyricsUrl;
                      lyricsSource = ksoft.source;
                    }
                  }
                  continue;
                }

                if (provider === 'onemusicapi') {
                  if (!lyricsText) {
                    const oneMusic = await searchOneMusicLyrics(artistVariant, titleVariant);
                    if (oneMusic?.lyricsText) {
                      lyricsText = oneMusic.lyricsText;
                      if (oneMusic.lyricsUrl && !lyricsUrl) lyricsUrl = oneMusic.lyricsUrl;
                      lyricsSource = oneMusic.source;
                    }
                  }
                }
              } catch (providerError) {
                const providerLabel = provider === 'lyricsovh' ? 'lyrics.ovh' : provider;
                providerErrors.push(providerError instanceof Error ? `${providerLabel}: ${providerError.message}` : `${providerLabel}: Unknown error`);
              }
            }
          }
        }

        if (lyricsUrl || lyricsText) {
          console.log(`    ✅ Found lyrics data (${lyricsSource})`);
          enrichedTracks.push({
            ...track,
            credits: {
              ...track.credits,
              ...(lyricsUrl ? { lyrics_url: lyricsUrl } : {}),
              ...(lyricsText ? { lyrics: lyricsText } : {}),
              lyrics_source: lyricsSource
            }
          });
          enrichedCount++;
          enrichedTracksList.push({
            position: track.position || '',
            title: track.title,
            ...(lyricsUrl ? { lyrics_url: lyricsUrl } : {}),
            ...(lyricsText ? { lyrics: '[text]' } : {}),
            source: lyricsSource
          });
        } else {
          console.log(`    ❌ No validated match found`);
          const failureReason = providerErrors.length > 0
            ? providerErrors.join(' | ')
            : `No validated match found (${activeProviders.join(', ')})`;
          enrichedTracks.push(track);
          const nextCredits = {
            ...(track.credits || {}),
            lyrics_last_attempt_at: new Date().toISOString(),
            lyrics_last_attempt_reason: failureReason,
            lyrics_last_attempt_track: track.title,
            lyrics_search_attempts: Number((track.credits || {}).lyrics_search_attempts ?? 0) + 1
          };
          enrichedTracks[enrichedTracks.length - 1] = {
            ...track,
            credits: nextCredits
          };
          failedCount++;
          failedTracksList.push({
            position: track.position || '',
            title: track.title,
            error: failureReason
          });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Search failed';
        console.log(`    ❌ Error: ${errorMsg}`);
        enrichedTracks.push(track);
        failedCount++;
        failedTracksList.push({
          position: track.position || '',
          title: track.title,
          error: errorMsg
        });
      }
    }

    console.log(`\n📊 SUMMARY: ${enrichedCount} enriched, ${skippedCount} skipped, ${failedCount} failed`);

    const failureSummary = failedTracksList.reduce<Record<string, number>>((acc, track) => {
      const raw = String(track.error ?? '').trim();
      const reason = raw.length > 0 ? raw : 'Unknown failure';
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});

    const tracksWithLyricsUpdates = enrichedTracks.filter(
      (track) => track.recording_id && (track.credits?.lyrics_url || track.credits?.lyrics || track.credits?.lyrics_last_attempt_at)
    );

    if (tracksWithLyricsUpdates.length > 0) {
      console.log(`💾 Updating database...`);
      for (const track of tracksWithLyricsUpdates) {
        const nextLyricsUrl = track.credits?.lyrics_url ? String(track.credits.lyrics_url) : null;
        const nextLyricsText = track.credits?.lyrics ? String(track.credits.lyrics) : null;
        const updatePayload: Record<string, unknown> = {
          credits: track.credits as unknown as import('types/supabase').Json
        };
        if (nextLyricsUrl) {
          updatePayload.lyrics_url = nextLyricsUrl;
        }
        if (nextLyricsText) {
          updatePayload.lyrics = nextLyricsText;
        }
        const { error: updateError } = await supabase
          .from('recordings')
          .update(updatePayload)
          .eq('id', track.recording_id as number);

        if (updateError) {
          console.log('❌ ERROR: Database update failed', updateError);
          return NextResponse.json({
            success: false,
            error: `Database update failed: ${updateError.message}`,
            data: {
              albumId: album.id,
              artist: artistName,
              title: albumTitle,
              enrichedCount
            }
          }, { status: 500 });
        }
      }
      console.log(`✅ Database updated successfully`);
    }

    console.log(`✅ Genius enrichment complete\n`);

    return NextResponse.json({
      success: enrichedCount > 0 || skippedCount === tracks.length,
      data: {
        albumId: album.id,
        artist: artistName,
        title: albumTitle,
        activeProviders,
        totalTracks: tracks.length,
        enrichedCount,
        syncedCount,
        attemptedCount,
        skippedCount,
        skippedExistingCount,
        skippedNoTitleCount,
        failedCount,
        failureSummary,
        enrichedTracks: enrichedTracksList,
        failedTracks: failedTracksList
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in Genius enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
// AUDIT: inspected, no changes.
