// src/app/api/enrich-sources/musicbrainz/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

type MusicBrainzRelease = {
  id: string;
  title: string;
  'artist-credit'?: Array<{ name: string }>;
  media?: Array<{
    tracks?: Array<{
      position: number;
      title: string;
      length?: number;
      recording?: { id: string };
    }>;
  }>;
  'label-info'?: Array<{
    label?: { name: string };
    'catalog-number'?: string;
  }>;
  date?: string;
  country?: string;
};

type MusicBrainzRecording = {
  relations?: Array<{
    type: string;
    artist?: { name: string; id: string };
    attributes?: string[];
  }>;
};

async function searchMusicBrainz(artist: string, title: string): Promise<string | null> {
  const query = `artist:"${artist}" AND release:"${title}"`;
  const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

  console.log(`  → Searching MusicBrainz: "${artist}" - "${title}"`);

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) {
    console.log(`  → MusicBrainz search failed: HTTP ${response.status}`);
    return null;
  }

  const data = await response.json();
  if (data.releases && data.releases.length > 0) {
    const official = data.releases.find((r: Record<string, unknown>) => 
      r.status === 'Official' && 
      (r['release-group'] as Record<string, unknown>)?.['primary-type'] === 'Album'
    );
    const mbid = official?.id || data.releases[0].id;
    console.log(`  → Found MusicBrainz release: ${mbid}`);
    return mbid;
  }

  console.log(`  → No MusicBrainz match found`);
  return null;
}

async function getMusicBrainzRelease(mbid: string): Promise<MusicBrainzRelease | null> {
  const url = `${MB_BASE}/release/${mbid}?inc=artists+labels+recordings+release-groups+media&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) return null;
  return response.json();
}

async function getMusicBrainzRecording(recordingId: string): Promise<MusicBrainzRecording | null> {
  const url = `${MB_BASE}/recording/${recordingId}?inc=artist-rels+work-rels&fmt=json`;

  const response = await fetch(url, {
    headers: { 'User-Agent': MB_USER_AGENT }
  });

  if (!response.ok) return null;
  return response.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { albumId } = body;

    console.log(`\n🎼 === MUSICBRAINZ ENRICHMENT for Album ID: ${albumId} ===`);

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
          label,
          catalog_number,
          country,
          release_date,
          master:masters (
            id,
            title,
            musicbrainz_release_group_id,
            artist:artists (name)
          ),
          release_tracks:release_tracks (
            recording_id,
            title_override,
            recording:recordings (
              id,
              title,
              credits
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

    const releaseRow = toSingle(album.release);
    const master = toSingle(releaseRow?.master);
    const artistName = toSingle(master?.artist)?.name ?? 'Unknown Artist';
    const albumTitle = master?.title ?? 'Untitled';

    console.log(`✓ Album found: "${artistName}" - "${albumTitle}"`);

    // Check if already enriched
    // Search or use existing MBID
    let mbid = master?.musicbrainz_release_group_id ?? null;
    if (!mbid) {
      mbid = await searchMusicBrainz(artistName, albumTitle);
      if (!mbid) {
        console.log(`❌ No MusicBrainz match found for "${artistName}" - "${albumTitle}"`);
        return NextResponse.json({
          success: false,
          error: 'No match found on MusicBrainz',
          data: {
            albumId: album.id,
            artist: artistName,
            title: albumTitle
          }
        });
      }
    }

    // Get release details
    console.log(`🔍 Fetching release details for ${mbid}...`);
    const release = await getMusicBrainzRelease(mbid);
    if (!release) {
      console.log('❌ Failed to fetch release details');
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch release details'
      }, { status: 500 });
    }

    // Collect credits from recordings
    const musiciansSet = new Set<string>();
    const producersSet = new Set<string>();
    const engineersSet = new Set<string>();
    const songwritersSet = new Set<string>();

    console.log(`🎵 Processing tracks for credits...`);
    let trackCount = 0;

    if (release.media) {
      for (const medium of release.media) {
        if (medium.tracks) {
          for (const track of medium.tracks) {
            if (track.recording?.id) {
              trackCount++;
              console.log(`  → Processing track ${trackCount}: ${track.title}`);
              
              const recording = await getMusicBrainzRecording(track.recording.id);
              if (recording?.relations) {
                for (const rel of recording.relations) {
                  const name = rel.artist?.name;
                  if (!name) continue;

                  if (rel.type === 'instrument' || rel.type === 'vocal' || rel.type === 'performer') {
                    musiciansSet.add(name);
                  } else if (rel.type === 'producer') {
                    producersSet.add(name);
                  } else if (rel.type === 'engineer' || rel.type === 'mix' || rel.type === 'mastering') {
                    engineersSet.add(name);
                  } else if (rel.type === 'composer' || rel.type === 'writer' || rel.type === 'lyricist') {
                    songwritersSet.add(name);
                  }
                }
              }
              
              // Rate limit
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
    }

    console.log(`✓ Found ${musiciansSet.size} musicians, ${producersSet.size} producers, ${engineersSet.size} engineers, ${songwritersSet.size} songwriters`);

    // Build update object
    const updateData: Record<string, unknown> = {
      musicbrainz_release_group_id: mbid,
    };

    const labelInfo = release['label-info']?.[0];
    const releaseUpdate: Record<string, unknown> = {};
    if (labelInfo?.label?.name) {
      releaseUpdate.label = labelInfo.label.name;
      console.log(`✓ Found label: ${labelInfo.label.name}`);
    }
    if (labelInfo?.['catalog-number']) {
      releaseUpdate.catalog_number = labelInfo['catalog-number'];
      console.log(`✓ Found catalog number: ${labelInfo['catalog-number']}`);
    }
    if (release.date) {
      releaseUpdate.release_date = release.date;
      console.log(`✓ Found release date: ${release.date}`);
    }
    if (release.country) {
      releaseUpdate.country = release.country;
      console.log(`✓ Found country: ${release.country}`);
    }

    console.log(`💾 Updating database...`);
    if (master?.id) {
      const { error: masterError } = await supabase
        .from('masters')
        .update(updateData)
        .eq('id', master.id);

      if (masterError) {
        console.log('❌ ERROR: Database update failed', masterError);
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${masterError.message}`,
          data: {
            albumId: album.id,
            artist: artistName,
            title: albumTitle,
            foundData: updateData
          }
        }, { status: 500 });
      }
    }

    if (releaseRow?.id && Object.keys(releaseUpdate).length > 0) {
      const { error: releaseError } = await supabase
        .from('releases')
        .update(releaseUpdate)
        .eq('id', releaseRow.id);

      if (releaseError) {
        console.log('❌ ERROR: Database update failed', releaseError);
        return NextResponse.json({
          success: false,
          error: `Database update failed: ${releaseError.message}`,
          data: {
            albumId: album.id,
            artist: artistName,
            title: albumTitle,
            foundData: releaseUpdate
          }
        }, { status: 500 });
      }
    }

    const trackMap = new Map(
      (releaseRow?.release_tracks ?? [])
        .map((track) => {
          const recording = toSingle(track.recording);
          const title = (track.title_override || recording?.title || '').toLowerCase().trim();
          return title && recording ? [title, recording] : null;
        })
        .filter((entry): entry is [string, { id?: number; credits?: unknown }] => Boolean(entry))
    );

    for (const recording of trackMap.values()) {
      const credits = typeof recording.credits === 'object' && recording.credits && !Array.isArray(recording.credits)
        ? { ...(recording.credits as Record<string, unknown>) }
        : {};

      credits.musicians = Array.from(musiciansSet);
      credits.producers = Array.from(producersSet);
      credits.engineers = Array.from(engineersSet);
      credits.songwriters = Array.from(songwritersSet);

      if (recording.id) {
        const { error: recordingError } = await supabase
          .from('recordings')
          .update({ credits })
          .eq('id', recording.id);

        if (recordingError) {
          console.log('❌ ERROR: Database update failed', recordingError);
          return NextResponse.json({
            success: false,
            error: `Database update failed: ${recordingError.message}`,
            data: {
              albumId: album.id,
              artist: artistName,
              title: albumTitle,
              foundData: credits
            }
          }, { status: 500 });
        }
      }
    }

    console.log(`✅ Successfully enriched with MusicBrainz data\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: album.id,
        artist: artistName,
        title: albumTitle,
        musicbrainz_id: mbid,
        musicbrainz_url: `https://musicbrainz.org/release/${mbid}`,
        musicians: musiciansSet.size,
        producers: producersSet.size,
        engineers: engineersSet.size,
        songwriters: songwritersSet.size,
        label: releaseUpdate.label,
        catalog_number: releaseUpdate.catalog_number,
        release_date: releaseUpdate.release_date,
        country: releaseUpdate.country
      }
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in MusicBrainz enrichment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
