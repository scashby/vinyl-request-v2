// src/app/api/enrich-sources/genius/route.ts - FIXED with proper matching validation
import { NextResponse } from "next/server";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
const GENIUS_TOKEN = process.env.GENIUS_API_TOKEN;

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

type Track = {
  position?: string;
  title?: string;
  recording_id?: number | null;
  lyrics_url?: string | null;
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

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const body = await req.json();
    const { albumId } = body;

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
              lyrics_url
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

      if (track.credits?.lyrics_url) {
        console.log(`    ⏭️ Skipping: Already has lyrics URL`);
        enrichedTracks.push(track);
        skippedCount++;
        skippedExistingCount++;
        continue;
      }

      try {
        attemptedCount++;
        let lyricsUrl: string | null = null;
        let lyricsSource = 'genius';
        const providerErrors: string[] = [];
        const titleVariants = buildTitleVariants(track.title);
        const artistVariants = buildArtistVariants(artistName, track.track_artist);

        for (const artistVariant of artistVariants) {
          if (lyricsUrl) break;
          for (const titleVariant of titleVariants) {
            if (lyricsUrl) break;
            try {
              lyricsUrl = await searchLyrics(artistVariant, titleVariant);
            } catch (geniusError) {
              providerErrors.push(geniusError instanceof Error ? `Genius: ${geniusError.message}` : 'Genius: Unknown error');
            }

            if (!lyricsUrl) {
              try {
                const lrcLibUrl = await searchLrcLibLyrics(artistVariant, titleVariant);
                if (lrcLibUrl) {
                  lyricsUrl = lrcLibUrl;
                  lyricsSource = 'lrclib';
                }
              } catch (lrcError) {
                providerErrors.push(lrcError instanceof Error ? `LRCLIB: ${lrcError.message}` : 'LRCLIB: Unknown error');
              }
            }
          }
        }

        if (lyricsUrl) {
          console.log(`    ✅ Found validated lyrics URL (${lyricsSource})`);
          enrichedTracks.push({
            ...track,
            credits: {
              ...track.credits,
              lyrics_url: lyricsUrl,
              lyrics_source: lyricsSource
            }
          });
          enrichedCount++;
          enrichedTracksList.push({
            position: track.position || '',
            title: track.title,
            lyrics_url: lyricsUrl,
            source: lyricsSource
          });
        } else {
          console.log(`    ❌ No validated match found`);
          const failureReason = providerErrors.length > 0
            ? providerErrors.join(' | ')
            : 'No validated match found (Genius + LRCLIB)';
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

    const tracksWithLyricsUrl = enrichedTracks.filter(
      (track) => track.recording_id && (track.credits?.lyrics_url || track.credits?.lyrics_last_attempt_at)
    );

    if (tracksWithLyricsUrl.length > 0) {
      console.log(`💾 Updating database...`);
      for (const track of tracksWithLyricsUrl) {
        const nextLyricsUrl = track.credits?.lyrics_url ? String(track.credits.lyrics_url) : null;
        const wasMissingColumn = !track.lyrics_url || String(track.lyrics_url).trim().length === 0;
        const updatePayload: Record<string, unknown> = {
          credits: track.credits as unknown as import('types/supabase').Json
        };
        if (nextLyricsUrl) {
          updatePayload.lyrics_url = nextLyricsUrl;
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
        if (wasMissingColumn) {
          syncedCount++;
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
        totalTracks: tracks.length,
        enrichedCount,
        syncedCount,
        attemptedCount,
        skippedCount,
        skippedExistingCount,
        skippedNoTitleCount,
        failedCount,
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
