// src/app/api/enrich-sources/fetch-candidates/route.ts
import { NextResponse } from "next/server";
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
  fetchWhoSampledData,
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
    const body = await req.json();
    const { 
      albumIds,
      cursor = 0,
      limit = 10,
      location, // FIXED: Expect 'location' not 'folder'
      services,
      autoSnooze = false,
      fields = [],
      missingDataOnly = false
    } = body;

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
            original_release_year,
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

    const results: { album: ReturnType<typeof mapInventoryToCandidate>, candidates: Record<string, CandidateData> }[] = [];

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
          original_release_year?: number | null;
          genres?: string[] | null;
          styles?: string[] | null;
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
        apple_music_id: albumDetails.apple_music_id ?? null,
        lastfm_id: albumDetails.lastfm_id ?? null,
        musicbrainz_url: albumDetails.musicbrainz_url ?? null,
        wikipedia_url: links.wikipedia_url ?? null,
        genius_url: links.genius_url ?? null,
        apple_music_url: links.apple_music_url ?? null,
        lastfm_url: links.lastfm_url ?? null,
        year: release?.release_year ?? master?.original_release_year ?? null,
        label: release?.label ?? null,
        cat_no: release?.catalog_number ?? null,
        genres: master?.genres ?? null,
        styles: master?.styles ?? null,
        tracks: releaseTracks.length > 0 ? ['has_tracks'] : [],
        tracklists: releaseTracks.length > 0 ? ['has_tracks'] : [],
        disc_metadata: albumDetails.disc_metadata ?? null,
        matrix_numbers: albumDetails.matrix_numbers ?? null,
        location: album.location ?? null,
        enriched_metadata: albumDetails.enriched_metadata ?? null,
        enrichment_summary: albumDetails.enrichment_summary ?? null,
        enrichment_sources: albumDetails.enrichment_sources ?? null,
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
        const [rootField] = field.split('.');
        return isEmptyValue((album as Record<string, unknown>)[rootField]);
      });
    };

    for (const chunk of chunks) {
       const chunkPromises = chunk.map(async (album) => {
          const candidates: Record<string, CandidateData> = {};
          const promises: Promise<EnrichmentResult | null>[] = [];

          const typedAlbum = mapInventoryToCandidate(album);

          if (!hasMissingSelectedField(typedAlbum)) {
            return null;
          }

          // Always fetch requested services
          if (services.musicbrainz) promises.push(fetchMusicBrainzData(typedAlbum));
          if (services.discogs) promises.push(fetchDiscogsData(typedAlbum));
          if (services.spotify) promises.push(fetchSpotifyData(typedAlbum));
          if (services.appleMusicEnhanced) promises.push(fetchAppleMusicData(typedAlbum));
          if (services.lastfm) promises.push(fetchLastFmData(typedAlbum));
          if (services.wikipedia) promises.push(fetchWikipediaData(typedAlbum));
          if (services.genius) promises.push(fetchGeniusData(typedAlbum));
          if (services.coverArt) promises.push(fetchCoverArtData(typedAlbum));
          if (services.whosampled) promises.push(fetchWhoSampledData(typedAlbum));
          if (services.secondhandsongs) promises.push(fetchSecondHandSongsData(typedAlbum));
          if (services.theaudiodb) promises.push(fetchTheAudioDBData(typedAlbum));
          if (services.wikidata) promises.push(fetchWikidataData(typedAlbum));
          if (services.setlistfm) promises.push(fetchSetlistFmData(typedAlbum));
          if (services.rateyourmusic) promises.push(fetchRateYourMusicData(typedAlbum));
          if (services.fanarttv) promises.push(fetchFanartTvData(typedAlbum));
          if (services.deezer) promises.push(fetchDeezerData(typedAlbum));
          if (services.musixmatch) promises.push(fetchMusixmatchData(typedAlbum));
          if (services.popsike) promises.push(fetchPopsikeData(typedAlbum));
          if (services.pitchfork) promises.push(fetchPitchforkData(typedAlbum));

          const settled = await Promise.allSettled(promises);
          
          settled.forEach(res => {
            if (res.status === 'fulfilled' && res.value && res.value.success && res.value.data) {
              candidates[res.value.source] = res.value.data;
            }
          });

          if (Object.keys(candidates).length > 0) {
            return { album: typedAlbum, candidates };
          }
          return null;
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
      processedCount: targetAlbums.length
    });

  } catch (error) {
    console.error("Enrichment Batch Error:", error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
