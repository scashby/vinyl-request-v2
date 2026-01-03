// src/app/api/enrich-sources/musicbrainz/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';

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
      .from('collection')
      .select('id, artist, title, musicbrainz_id, musicians, producers, engineers, songwriters, studio, labels')
      .eq('id', albumId)
      .single();

    if (dbError || !album) {
      console.log('❌ ERROR: Album not found in database', dbError);
      return NextResponse.json({
        success: false,
        error: 'Album not found'
      }, { status: 404 });
    }

    console.log(`✓ Album found: "${album.artist}" - "${album.title}"`);

    // Check if already enriched
    const hasMusicians = album.musicians && Array.isArray(album.musicians) && album.musicians.length > 0;
    const hasProducers = album.producers && Array.isArray(album.producers) && album.producers.length > 0;
    
    if (hasMusicians && hasProducers) {
      console.log(`⏭️ Album already has MusicBrainz credits`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Album already has MusicBrainz credits',
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          musicbrainz_id: album.musicbrainz_id
        }
      });
    }

    // Search or use existing MBID
    let mbid = album.musicbrainz_id;
    if (!mbid) {
      mbid = await searchMusicBrainz(album.artist, album.title);
      if (!mbid) {
        console.log(`❌ No MusicBrainz match found for "${album.artist}" - "${album.title}"`);
        return NextResponse.json({
          success: false,
          error: 'No match found on MusicBrainz',
          data: {
            albumId: album.id,
            artist: album.artist,
            title: album.title
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
      musicbrainz_id: mbid,
      musicbrainz_url: `https://musicbrainz.org/release/${mbid}`,
    };

    if (musiciansSet.size > 0) updateData.musicians = Array.from(musiciansSet);
    if (producersSet.size > 0) updateData.producers = Array.from(producersSet);
    if (engineersSet.size > 0) updateData.engineers = Array.from(engineersSet);
    if (songwritersSet.size > 0) updateData.songwriters = Array.from(songwritersSet);

    // Extract label and catalog number
    const labelInfo = release['label-info']?.[0];
    if (labelInfo?.label?.name && (!album.labels || album.labels.length === 0)) {
      updateData.labels = [labelInfo.label.name];
      console.log(`✓ Found label: ${labelInfo.label.name}`);
    }
    if (labelInfo?.['catalog-number']) {
      updateData.cat_no = labelInfo['catalog-number'];
      console.log(`✓ Found catalog number: ${labelInfo['catalog-number']}`);
    }

    // Recording date and country
    if (release.date) {
      updateData.recording_date = release.date;
      console.log(`✓ Found recording date: ${release.date}`);
    }
    if (release.country) {
      updateData.country = release.country;
      console.log(`✓ Found country: ${release.country}`);
    }

    // Update database
    console.log(`💾 Updating database...`);
    const { error: updateError } = await supabase
      .from('collection')
      .update(updateData)
      .eq('id', albumId);

    if (updateError) {
      console.log('❌ ERROR: Database update failed', updateError);
      return NextResponse.json({
        success: false,
        error: `Database update failed: ${updateError.message}`,
        data: {
          albumId: album.id,
          artist: album.artist,
          title: album.title,
          foundData: updateData
        }
      }, { status: 500 });
    }

    console.log(`✅ Successfully enriched with MusicBrainz data\n`);

    return NextResponse.json({
      success: true,
      data: {
        albumId: album.id,
        artist: album.artist,
        title: album.title,
        musicbrainz_id: mbid,
        musicbrainz_url: updateData.musicbrainz_url,
        musicians: (updateData.musicians as unknown[] | undefined)?.length || 0,
        producers: (updateData.producers as unknown[] | undefined)?.length || 0,
        engineers: (updateData.engineers as unknown[] | undefined)?.length || 0,
        songwriters: (updateData.songwriters as unknown[] | undefined)?.length || 0,
        label: (updateData.labels as string[] | undefined)?.[0],
        catalog_number: updateData.cat_no,
        recording_date: updateData.recording_date,
        country: updateData.country
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