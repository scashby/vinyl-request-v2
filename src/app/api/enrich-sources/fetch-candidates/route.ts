// src/app/api/enrich-sources/fetch-candidates/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthHeader, supabaseServer } from "src/lib/supabaseServer";
import { 
  fetchSpotifyData, 
  fetchMusicBrainzData, 
  fetchDiscogsData, 
  fetchLastFmData, 
  fetchAppleMusicData, 
  fetchCoverArtData, 
  fetchWikipediaData, 
  fetchGeniusData,
  fetchSecondHandSongsData,
  fetchTheAudioDBData,
  fetchWikidataData,
  fetchSetlistFmData,
  fetchRateYourMusicData,
  fetchFanartTvData,
  fetchDeezerData,
  fetchMusixmatchData,
  fetchPopsikeData,
  fetchPitchforkData,
  type CandidateData, 
  type EnrichmentResult
} from "lib/enrichment-utils";
import { FIELD_TO_SERVICES } from "lib/enrichment-data-mapping";
import { getDiscogsOAuthFromCookieHeader, hasDiscogsCredentials } from "lib/discogsAuth";

// Helper to chunk arrays for concurrency control
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export async function POST(req: Request) {
  const supabase = supabaseServer(getAuthHeader(req));
  try {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const sourceTimeoutMs = 12000;
    const withSourceTimeout = async <T,>(source: string, promise: Promise<T>): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`${source} timed out after ${sourceTimeoutMs / 1000}s`)), sourceTimeoutMs);
        })
      ]);
    };
    const cookieStore = await cookies();
    const discogsToken = cookieStore.get('discogs_access_token')?.value;
    const discogsSecret = cookieStore.get('discogs_access_secret')?.value;
    const fallbackCookieHeader = req.headers.get('cookie');
    const discogsOAuth = (discogsToken && discogsSecret)
      ? getDiscogsOAuthFromCookieHeader(`discogs_access_token=${encodeURIComponent(discogsToken)}; discogs_access_secret=${encodeURIComponent(discogsSecret)}`)
      : getDiscogsOAuthFromCookieHeader(fallbackCookieHeader);
    let discogsQueue: Promise<void> = Promise.resolve();
    let spotifyQueue: Promise<void> = Promise.resolve();
    const runDiscogsQueued = async (
      album: { artist: string; title: string; discogs_release_id?: string }
    ): Promise<EnrichmentResult> => {
      const pending = discogsQueue
        .catch(() => undefined)
        .then(() => fetchDiscogsData(album, { oauth: discogsOAuth }))
        .finally(async () => {
          await sleep(250);
        });
      discogsQueue = pending.then(() => undefined, () => undefined);
      return pending;
    };
    const runSpotifyQueued = async (
      album: { artist: string; title: string; spotify_id?: string }
    ): Promise<EnrichmentResult> => {
      const pending = spotifyQueue
        .catch(() => undefined)
        .then(() => fetchSpotifyData(album))
        .finally(async () => {
          await sleep(350);
        });
      spotifyQueue = pending.then(() => undefined, () => undefined);
      return pending;
    };

    const body = await req.json();
    const { 
      albumIds,
      cursor = 0,
      limit = 10,
      maxId,
      location, // FIXED: Expect 'location' not 'folder'
      services,
      autoSnooze = false,
      fields = [],
      missingDataOnly = false
    } = body;

    // Preflight: fail fast when selected fields depend on services that are definitely unavailable.
    const selectedFields = Array.isArray(fields)
      ? fields.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];
    const requiredServices = new Set<string>();
    selectedFields.forEach((field) => {
      const serviceList = FIELD_TO_SERVICES[field] ?? FIELD_TO_SERVICES[field.split('.')[0]] ?? [];
      serviceList.forEach((svc) => requiredServices.add(svc));
    });

    const unavailableServices = new Set<string>();
    const discogsAvailable = Boolean(discogsOAuth) || hasDiscogsCredentials();
    if (requiredServices.has('discogs') && !discogsAvailable) {
      unavailableServices.add('discogs');
    }

    let targetAlbums: Record<string, unknown>[] = [];
    let nextCursor = null;

    const baseQuery = supabase
      .from('inventory')
      .select(`
        id,
        location,
        release:releases (
          id,
          discogs_release_id,
          spotify_album_id,
          release_year,
          barcode,
          country,
          label,
          catalog_number,
          notes,
          media_type,
          format_details,
          qty,
          master:masters (
            id,
            title,
            cover_image_url,
            discogs_master_id,
            musicbrainz_release_group_id,
            genres,
            styles,
            lastfm_similar_albums,
            notes,
            original_release_year,
            recording_date,
            wikipedia_url,
            apple_music_url,
            lastfm_url,
            cultural_significance,
            recording_location,
            critical_reception,
            pitchfork_score,
            chart_positions,
            awards,
            certifications,
            artist:artists (name),
            master_tag_links:master_tag_links (
              tag:master_tags ( name )
            )
          ),
          release_tracks:release_tracks (
            id,
            recording:recordings ( credits )
          )
        )
      `);

    if (albumIds && albumIds.length > 0) {
      const { data, error } = await baseQuery.in('id', albumIds);
      if (error) throw error;
      targetAlbums = data || [];
    } else {
      let query = baseQuery
        .gt('id', cursor)
        .order('id', { ascending: true })
        .limit(limit);

      if (location) query = query.eq('location', location);
      if (typeof maxId === 'number' && Number.isFinite(maxId) && maxId > 0) {
        query = query.lte('id', maxId);
      }

      // SERVER-SIDE SNOOZE FILTERING
      void autoSnooze;

      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];

      // Always advance cursor based on raw fetch to ensure progress
      if (fetched.length > 0) {
        const last = fetched[fetched.length - 1] as { id?: number | string };
        if (typeof last.id === 'number') nextCursor = last.id;
        if (typeof last.id === 'string') nextCursor = parseInt(last.id, 10);
      }

      targetAlbums = fetched as unknown as CandidateAlbumRow[];
    }

    if (!targetAlbums.length) {
      return NextResponse.json({ 
        success: true, 
        results: [], 
        nextCursor: nextCursor,
        message: "No albums found in this batch." 
      });
    }

    const results: {
      album: ReturnType<typeof mapInventoryToCandidate>,
      candidates: Record<string, CandidateData>,
      sourceDiagnostics?: Record<string, { status: 'returned' | 'no_data' | 'error'; reason?: string }>,
      attemptedSources?: string[],
      sourceFieldCoverage?: Record<string, string[]>,
      scanNote?: string
    }[] = [];

    type CandidateAlbumRow = {
      id: number;
      location?: string | null;
      release?: {
        id?: number | null;
        media_type?: string | null;
        format_details?: string[] | null;
        qty?: number | null;
        discogs_release_id?: string | null;
        spotify_album_id?: string | null;
        release_year?: number | null;
        barcode?: string | null;
        country?: string | null;
        label?: string | null;
        catalog_number?: string | null;
        notes?: string | null;
        release_tracks?: {
          id?: number | null;
          recording?: { credits?: unknown } | { credits?: unknown }[] | null;
        }[] | null;
        master?: {
          id?: number | null;
          title?: string | null;
          cover_image_url?: string | null;
          discogs_master_id?: string | null;
          musicbrainz_release_group_id?: string | null;
          notes?: string | null;
          original_release_year?: number | null;
          recording_date?: string | null;
          wikipedia_url?: string | null;
          apple_music_url?: string | null;
          lastfm_url?: string | null;
          cultural_significance?: string | null;
          recording_location?: string | null;
          critical_reception?: string | null;
          pitchfork_score?: number | string | null;
          chart_positions?: string[] | null;
          awards?: string[] | null;
          certifications?: string[] | null;
          genres?: string[] | null;
          styles?: string[] | null;
          lastfm_similar_albums?: string[] | null;
          artist?: { name?: string | null } | null;
          master_tag_links?: {
            tag?: { name?: string | null } | null;
          }[] | null;
        } | null;
      } | null;
    };

    const asRecord = (value: unknown): Record<string, unknown> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return value as Record<string, unknown>;
    };

    const asString = (value: unknown): string | null => {
      if (value === null || value === undefined) return null;
      const str = String(value).trim();
      return str.length > 0 ? str : null;
    };

    const asStringArray = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
      }
      if (typeof value === 'string') return [value];
      return [];
    };

    const getAlbumCredits = (credits: unknown) => {
      const record = asRecord(credits);
      const albumPeople = asRecord(record.album_people ?? record.albumPeople);
      const classical = asRecord(record.classical);
      const artwork = asRecord(record.artwork ?? record.album_artwork ?? record.albumArtwork);
      const albumDetails = asRecord(record.album_details ?? record.albumDetails ?? record.album_metadata);
      const links = asRecord(albumDetails.links ?? albumDetails.link ?? {});
      return { albumPeople, classical, artwork, albumDetails, links };
    };

    const mapInventoryToCandidate = (album: CandidateAlbumRow) => {
      const release = album.release;
      const master = release?.master;
      const releaseTracks = release?.release_tracks ?? [];
      const firstRecording = releaseTracks[0]?.recording
        ? (Array.isArray(releaseTracks[0].recording) ? releaseTracks[0].recording[0] : releaseTracks[0].recording)
        : null;
      const trackCredits = releaseTracks
        .map((track) => {
          const recording = track.recording
            ? (Array.isArray(track.recording) ? track.recording[0] : track.recording)
            : null;
          return asRecord(recording?.credits);
        })
        .filter((credit) => Object.keys(credit).length > 0);
      const hasLyricsUrl = trackCredits.some((credit) => typeof credit.lyrics_url === 'string' && credit.lyrics_url.trim().length > 0);
      const hasLyrics = trackCredits.some((credit) => typeof credit.lyrics === 'string' && credit.lyrics.trim().length > 0);
      const creditsInfo = getAlbumCredits(firstRecording?.credits);
      const { albumPeople, classical, artwork, albumDetails, links } = creditsInfo;
      const formatParts = [release?.media_type, ...(release?.format_details ?? [])].filter(Boolean);
      const baseFormat = formatParts.join(', ');
      const qty = release?.qty ?? 1;
      const formatLabel = baseFormat ? (qty > 1 ? `${qty}x${baseFormat}` : baseFormat) : '';
      const tags = (master?.master_tag_links ?? [])
        .map((link) => link.tag?.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);

      return {
        id: album.id,
        release_id: release?.id ?? null,
        master_id: master?.id ?? null,
        artist: master?.artist?.name ?? 'Unknown Artist',
        title: master?.title ?? 'Untitled',
        format: formatLabel,
        image_url: master?.cover_image_url ?? null,
        notes: release?.notes ?? null,
        tags: tags.length > 0 ? tags : null,
        back_image_url: artwork.back_image_url ?? null,
        spine_image_url: artwork.spine_image_url ?? null,
        inner_sleeve_images: asStringArray(artwork.inner_sleeve_images),
        vinyl_label_images: asStringArray(artwork.vinyl_label_images),
        musicians: asStringArray(albumPeople.musicians),
        producers: asStringArray(albumPeople.producers),
        engineers: asStringArray(albumPeople.engineers),
        songwriters: asStringArray(albumPeople.songwriters),
        composer: classical.composer ?? null,
        conductor: classical.conductor ?? null,
        orchestra: classical.orchestra ?? null,
        chorus: classical.chorus ?? null,
        discogs_release_id: release?.discogs_release_id ?? null,
        discogs_master_id: master?.discogs_master_id ?? null,
        musicbrainz_id: master?.musicbrainz_release_group_id ?? null,
        spotify_id: release?.spotify_album_id ?? null,
        apple_music_id: asString(albumDetails.apple_music_id),
        lastfm_id: asString(albumDetails.lastfm_id),
        musicbrainz_url: asString(albumDetails.musicbrainz_url),
        genius_url: asString(links.genius_url),
        barcode: release?.barcode ?? null,
        country: release?.country ?? null,
        recording_date: master?.recording_date ?? null,
        release_notes: release?.notes ?? null,
        year: release?.release_year ?? master?.original_release_year ?? null,
        label: release?.label ?? null,
        cat_no: release?.catalog_number ?? null,
        genres: master?.genres ?? null,
        styles: master?.styles ?? null,
        lastfm_similar_albums: master?.lastfm_similar_albums ?? null,
        master_notes: master?.notes ?? null,
        cultural_significance: master?.cultural_significance ?? albumDetails.cultural_significance ?? null,
        recording_location: master?.recording_location ?? albumDetails.recording_location ?? null,
        critical_reception: master?.critical_reception ?? albumDetails.critical_reception ?? null,
        apple_music_editorial_notes: albumDetails.apple_music_editorial_notes ?? null,
        pitchfork_score: master?.pitchfork_score ?? albumDetails.pitchfork_score ?? null,
        chart_positions: master?.chart_positions ?? albumDetails.chart_positions ?? null,
        awards: master?.awards ?? albumDetails.awards ?? null,
        certifications: master?.certifications ?? albumDetails.certifications ?? null,
        wikipedia_url: asString(master?.wikipedia_url) ?? asString(links.wikipedia_url),
        apple_music_url: asString(master?.apple_music_url) ?? asString(links.apple_music_url),
        lastfm_url: asString(master?.lastfm_url) ?? asString(links.lastfm_url),
        tracks: releaseTracks.length > 0 ? ['has_tracks'] : [],
        tracklists: releaseTracks.length > 0 ? ['has_tracks'] : [],
        tracks_lyrics_url: hasLyricsUrl ? ['has_lyrics_url'] : [],
        tracks_lyrics: hasLyrics ? ['has_lyrics'] : [],
        disc_metadata: albumDetails.disc_metadata ?? null,
        matrix_numbers: albumDetails.matrix_numbers ?? null,
        location: album.location ?? null,
        enriched_metadata: albumDetails.enriched_metadata ?? null,
        enrichment_summary: albumDetails.enrichment_summary ?? null,
        enrichment_sources: albumDetails.enrichment_sources ?? null,
        samples: asStringArray(albumDetails.samples),
        sampled_by: asStringArray(albumDetails.sampled_by),
        finalized_fields: albumDetails.finalized_fields ?? null,
        last_reviewed_at: albumDetails.last_reviewed_at ?? null
      };
    };

    // --- UPDATED CONCURRENCY LOGIC ---
    // Process albums in chunks of 5 to speed up response time while respecting rate limits
    const CHUNK_SIZE = 5;
    const chunks = chunkArray(targetAlbums as CandidateAlbumRow[], CHUNK_SIZE);

    const isEmptyValue = (value: unknown) => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed || trimmed === '[]' || trimmed === 'null') return true;
      }
      if (Array.isArray(value)) {
        return value.length === 0 || value.every(v => v === null || v === undefined || String(v).trim() === '');
      }
      if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
      return false;
    };

    const hasMissingSelectedField = (album: ReturnType<typeof mapInventoryToCandidate>) => {
      if (!missingDataOnly || !fields.length) return true;
      return fields.some((field: string) => {
        if (field === 'tracks.lyrics_url') {
          return isEmptyValue((album as Record<string, unknown>).tracks_lyrics_url);
        }
        if (field === 'tracks.lyrics') {
          const hasLyrics = !isEmptyValue((album as Record<string, unknown>).tracks_lyrics);
          const hasLyricsUrl = !isEmptyValue((album as Record<string, unknown>).tracks_lyrics_url);
          return !(hasLyrics || hasLyricsUrl);
        }
        const [rootField] = field.split('.');
        return isEmptyValue((album as Record<string, unknown>)[rootField]);
      });
    };

    for (const chunk of chunks) {
       const chunkPromises = chunk.map(async (album) => {
          const candidates: Record<string, CandidateData> = {};
          const sourceDiagnostics: Record<string, { status: 'returned' | 'no_data' | 'error'; reason?: string }> = {};
          const sourceFieldCoverage: Record<string, string[]> = {};
          const tasks: { source: string; promise: Promise<EnrichmentResult | null> }[] = [];

          const typedAlbum = mapInventoryToCandidate(album);

          if (!hasMissingSelectedField(typedAlbum)) {
            return {
              album: typedAlbum,
              candidates,
              sourceDiagnostics: {},
              attemptedSources: [],
              sourceFieldCoverage: {},
              scanNote: 'Skipped before source fetch: selected fields already populated for this album'
            };
          }

          unavailableServices.forEach((source) => {
            sourceDiagnostics[source] = {
              status: 'no_data',
                reason: source === 'discogs'
                ? 'service unavailable for this run: no discogs oauth cookie or server discogs credentials configured'
                : 'service unavailable for this run'
            };
          });

          const addTask = (source: string, promise: Promise<EnrichmentResult | null>) => {
            tasks.push({ source, promise: withSourceTimeout(source, promise) });
          };

          // Always fetch requested services
          if (services.musicbrainz) addTask('musicbrainz', fetchMusicBrainzData(typedAlbum));
          if (services.discogs && !unavailableServices.has('discogs')) {
            addTask('discogs', runDiscogsQueued(typedAlbum));
          }
          if (services.spotify) addTask('spotify', runSpotifyQueued(typedAlbum));
          if (services.appleMusicEnhanced) addTask('appleMusic', fetchAppleMusicData(typedAlbum));
          if (services.lastfm) addTask('lastfm', fetchLastFmData(typedAlbum));
          if (services.wikipedia) addTask('wikipedia', fetchWikipediaData(typedAlbum));
          if (services.genius) addTask('genius', fetchGeniusData(typedAlbum));
          if (services.coverArt) addTask('coverArt', fetchCoverArtData(typedAlbum));
          if (services.secondhandsongs) {
            addTask('secondhandsongs', fetchSecondHandSongsData(typedAlbum));
          }
          if (services.theaudiodb) addTask('theaudiodb', fetchTheAudioDBData(typedAlbum));
          if (services.wikidata) addTask('wikidata', fetchWikidataData(typedAlbum));
          if (services.setlistfm) addTask('setlistfm', fetchSetlistFmData(typedAlbum));
          if (services.rateyourmusic) addTask('rateyourmusic', fetchRateYourMusicData(typedAlbum));
          if (services.fanarttv) addTask('fanarttv', fetchFanartTvData(typedAlbum));
          if (services.deezer) addTask('deezer', fetchDeezerData(typedAlbum));
          if (services.musixmatch) addTask('musixmatch', fetchMusixmatchData(typedAlbum));
          if (services.popsike) addTask('popsike', fetchPopsikeData(typedAlbum));
          if (services.pitchfork) addTask('pitchfork', fetchPitchforkData(typedAlbum));

          const settled = await Promise.allSettled(tasks.map((task) => task.promise));
          
          settled.forEach((res, index) => {
            const task = tasks[index];
            if (res.status === 'fulfilled') {
              const value = res.value;
              if (value && value.success && value.data) {
                candidates[value.source] = value.data;
                sourceFieldCoverage[task.source] = Object.entries(value.data)
                  .filter(([, v]) => {
                    if (v === null || v === undefined) return false;
                    if (typeof v === 'string') return v.trim().length > 0;
                    if (Array.isArray(v)) return v.length > 0;
                    if (typeof v === 'object') return Object.keys(v as Record<string, unknown>).length > 0;
                    return true;
                  })
                  .map(([k]) => k);
                sourceDiagnostics[task.source] = { status: 'returned' };
              } else {
                sourceFieldCoverage[task.source] = [];
                const authHint = task.source === 'discogs'
                  ? (
                    discogsOAuth
                      ? 'discogs auth: oauth cookie present'
                      : (hasDiscogsCredentials() ? 'discogs auth: server credentials present' : 'discogs auth: unavailable')
                  )
                  : null;
                sourceDiagnostics[task.source] = {
                  status: 'no_data',
                  reason: authHint
                    ? `${authHint} | ${value?.error || 'No match'}`
                    : (value?.error || 'No match')
                };
              }
            } else {
              sourceFieldCoverage[task.source] = [];
              const authHint = task.source === 'discogs'
                ? (
                  discogsOAuth
                    ? 'discogs auth: oauth cookie present'
                    : (hasDiscogsCredentials() ? 'discogs auth: server credentials present' : 'discogs auth: unavailable')
                )
                : null;
              sourceDiagnostics[task.source] = {
                status: 'error',
                reason: authHint
                  ? `${authHint} | ${res.reason instanceof Error ? res.reason.message : 'Unknown error'}`
                  : (res.reason instanceof Error ? res.reason.message : 'Unknown error')
              };
            }
          });

          if (Object.keys(candidates).length > 0) {
            return {
              album: typedAlbum,
              candidates,
              sourceDiagnostics,
              attemptedSources: tasks.map((task) => task.source),
              sourceFieldCoverage
            };
          }
          return {
            album: typedAlbum,
            candidates,
            sourceDiagnostics,
            attemptedSources: tasks.map((task) => task.source),
            sourceFieldCoverage
          };
       });

       // Wait for this chunk of albums to complete
       const chunkResults = await Promise.all(chunkPromises);
       
       chunkResults.forEach(res => {
          if (res) results.push(res);
       });
    }

    return NextResponse.json({ 
      success: true, 
      results, 
      nextCursor: nextCursor,
      processedCount: targetAlbums.length,
      preflight: {
        unavailableServices: Array.from(unavailableServices),
        requiredServices: Array.from(requiredServices),
        discogsOAuthPresent: Boolean(discogsOAuth),
        discogsServerCredentialsPresent: hasDiscogsCredentials(),
      }
    });

  } catch (error) {
    console.error("Enrichment Batch Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
// AUDIT: updated for V3 alignment, UI parity, and build stability.
