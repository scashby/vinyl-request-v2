// lib/enrichment-utils.ts - ALL 9 SERVICES FULLY WORKING
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type EnrichmentResult<T = Record<string, unknown>> = {
  success: boolean;
  error?: string;
  skipped?: boolean;
  data?: T;
};

// ============================================================================
// 1. MUSICBRAINZ + COVER ART ARCHIVE + ACOUSTICBRAINZ
// ============================================================================

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_USER_AGENT = 'DeadwaxDialogues/1.0 (https://deadwaxdialogues.com)';
const CAA_BASE = 'https://coverartarchive.org';

async function mbSearch(artist: string, title: string, barcode?: string): Promise<string | null> {
  try {
    const query = barcode ? `barcode:"${barcode}"` : `artist:"${artist}" AND release:"${title}"`;
    const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const res = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.releases?.length) return null;
    const official = data.releases.find((r: Record<string, unknown>) => 
      r.status === 'Official' && (r['release-group'] as Record<string, unknown>)?.['primary-type'] === 'Album'
    );
    return (official?.id || data.releases[0].id) as string;
  } catch { return null; }
}

async function mbGetRelease(mbid: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${MB_BASE}/release/${mbid}?inc=artists+labels+recordings+release-groups+media+artist-credits+isrcs&fmt=json`;
    const res = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function mbGetRecording(recId: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${MB_BASE}/recording/${recId}?inc=artist-rels+work-rels+isrcs&fmt=json`;
    const res = await fetch(url, { headers: { 'User-Agent': MB_USER_AGENT } });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function caaGet(mbid: string): Promise<Array<Record<string, unknown>> | null> {
  try {
    const res = await fetch(`${CAA_BASE}/release/${mbid}`, { headers: { 'User-Agent': MB_USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.images as Array<Record<string, unknown>>) || null;
  } catch { return null; }
}

async function abLowLevel(recId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://acousticbrainz.org/api/v1/${recId}/low-level`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function abHighLevel(recId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://acousticbrainz.org/api/v1/${recId}/high-level`);
    return res.ok ? res.json() : null;
  } catch { return null; }
}

export async function enrichMusicBrainz(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,artist,title,barcode,musicbrainz_id,musicians,producers,image_url,back_image_url,labels')
      .eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    const hasData = album.musicians?.length > 0 && album.producers?.length > 0 && album.musicbrainz_id;
    if (hasData) return { success: true, skipped: true };

    const mbid = album.musicbrainz_id || await mbSearch(album.artist, album.title, album.barcode);
    if (!mbid) return { success: false, error: 'Not found' };

    const release = await mbGetRelease(mbid);
    if (!release) return { success: false, error: 'Failed to fetch' };

    const coverArt = await caaGet(mbid);
    const musicians = new Set<string>(), producers = new Set<string>(), engineers = new Set<string>();
    const songwriters = new Set<string>(), composers = new Set<string>(), conductors = new Set<string>();
    const orchestras = new Set<string>(), choruses = new Set<string>();
    const tempos: number[] = [], keys: string[] = [];
    let danceSum = 0, acousticSum = 0, aggressiveSum = 0, electronicSum = 0;
    let happySum = 0, partySum = 0, relaxedSum = 0, sadSum = 0;
    const energySum = 0;
    let moodCnt = 0;

    const media = release.media as Array<{ tracks?: Array<{ recording?: { id: string }; position: number; title: string; length?: number }> }> | undefined;
    if (media) {
      for (const medium of media) {
        if (!medium.tracks) continue;
        for (const track of medium.tracks) {
          if (!track.recording?.id) continue;
          const rec = await mbGetRecording(track.recording.id);
          if (rec?.relations) {
            for (const rel of rec.relations as Array<Record<string, unknown>>) {
              const name = (rel.artist as Record<string, unknown>)?.name as string;
              const type = rel.type as string;
              if (!name) {
                const work = rel.work as Record<string, unknown> | undefined;
                if (work?.relations) {
                  for (const wr of work.relations as Array<Record<string, unknown>>) {
                    const wn = (wr.artist as Record<string, unknown>)?.name as string;
                    if (wn && wr.type === 'composer') composers.add(wn);
                  }
                }
                continue;
              }
              if (type === 'instrument' || type === 'vocal' || type === 'performer') musicians.add(name);
              else if (type === 'producer') producers.add(name);
              else if (type === 'engineer' || type === 'mix' || type === 'mastering') engineers.add(name);
              else if (type === 'composer' || type === 'writer' || type === 'lyricist') { songwriters.add(name); composers.add(name); }
              else if (type === 'conductor') conductors.add(name);
              else if (type === 'performing orchestra') orchestras.add(name);
              else if (type === 'chorus master' || type === 'choir vocals') choruses.add(name);
            }
          }
          const abLow = await abLowLevel(track.recording.id);
          const abHigh = await abHighLevel(track.recording.id);
          if (abLow?.rhythm) {
            const bpm = (abLow.rhythm as Record<string, unknown>).bpm as number | undefined;
            if (bpm) tempos.push(bpm);
          }
          if (abLow?.tonal) {
            const tonal = abLow.tonal as Record<string, unknown>;
            const kk = tonal.key_key as string | undefined;
            const ks = tonal.key_scale as string | undefined;
            if (kk && ks) keys.push(`${kk} ${ks}`);
          }
          if (abHigh?.highlevel) {
            const hl = abHigh.highlevel as Record<string, Record<string, Record<string, number>>>;
            if (hl.danceability?.all?.danceable) { danceSum += hl.danceability.all.danceable; moodCnt++; }
            if (hl.mood_acoustic?.all?.acoustic) acousticSum += hl.mood_acoustic.all.acoustic;
            if (hl.mood_aggressive?.all?.aggressive) aggressiveSum += hl.mood_aggressive.all.aggressive;
            if (hl.mood_electronic?.all?.electronic) electronicSum += hl.mood_electronic.all.electronic;
            if (hl.mood_happy?.all?.happy) happySum += hl.mood_happy.all.happy;
            if (hl.mood_party?.all?.party) partySum += hl.mood_party.all.party;
            if (hl.mood_relaxed?.all?.relaxed) relaxedSum += hl.mood_relaxed.all.relaxed;
            if (hl.mood_sad?.all?.sad) sadSum += hl.mood_sad.all.sad;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    const update: Record<string, unknown> = { musicbrainz_id: mbid, musicbrainz_url: `https://musicbrainz.org/release/${mbid}` };
    if (musicians.size) update.musicians = Array.from(musicians);
    if (producers.size) update.producers = Array.from(producers);
    if (engineers.size) update.engineers = Array.from(engineers);
    if (songwriters.size) update.songwriters = Array.from(songwriters);
    if (composers.size) update.composer = Array.from(composers);
    if (conductors.size) update.conductor = Array.from(conductors);
    if (orchestras.size) update.orchestra = Array.from(orchestras);
    if (choruses.size) update.chorus = Array.from(choruses);

    if (coverArt) {
      const front = coverArt.find(i => i.front === true)?.image as string | undefined;
      const back = coverArt.find(i => i.back === true)?.image as string | undefined;
      const spine = coverArt.filter(i => (i.types as string[]).includes('Spine')).map(i => i.image as string);
      const inner = coverArt.filter(i => {
        const types = i.types as string[];
        return types.includes('Medium') || types.includes('Booklet');
      }).map(i => i.image as string);
      if (front && !album.image_url) update.image_url = front;
      if (back && !album.back_image_url) update.back_image_url = back;
      if (spine.length) update.spine_image_url = spine[0];
      if (inner.length) update.inner_sleeve_images = inner;
    }

    const labelInfo = (release['label-info'] as Array<Record<string, unknown>> | undefined)?.[0];
    if (labelInfo?.label && (!album.labels || (album.labels as unknown[]).length === 0)) {
      update.labels = [(labelInfo.label as Record<string, string>).name];
    }
    if (labelInfo?.['catalog-number']) update.cat_no = labelInfo['catalog-number'];
    if (release.date) update.recording_date = release.date;
    if (release.country) update.country = release.country;
    const rg = release['release-group'] as Record<string, unknown> | undefined;
    if (rg?.['first-release-date']) update.original_release_date = rg['first-release-date'];

    if (tempos.length) update.tempo_bpm = Math.round(tempos.reduce((a, b) => a + b) / tempos.length);
    if (keys.length) {
      const kc: Record<string, number> = {};
      keys.forEach(k => kc[k] = (kc[k] || 0) + 1);
      update.musical_key = Object.entries(kc).sort((a, b) => b[1] - a[1])[0][0];
    }
    if (moodCnt > 0) {
      update.danceability = danceSum / moodCnt;
      update.energy = energySum / moodCnt;
      update.mood_acoustic = acousticSum / moodCnt;
      update.mood_aggressive = aggressiveSum / moodCnt;
      update.mood_electronic = electronicSum / moodCnt;
      update.mood_happy = happySum / moodCnt;
      update.mood_party = partySum / moodCnt;
      update.mood_relaxed = relaxedSum / moodCnt;
      update.mood_sad = sadSum / moodCnt;
    }

    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: { musicbrainz_id: mbid, musicians: musicians.size, producers: producers.size } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 2. LAST.FM
// ============================================================================

const LFM_KEY = process.env.LASTFM_API_KEY!;
const LFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

export async function enrichLastFm(albumId: number): Promise<EnrichmentResult> {
  try {
    if (!LFM_KEY) return { success: false, error: 'API key not configured' };
    const { data: album } = await supabase.from('collection')
      .select('id,artist,title,image_url,custom_tags').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    const url = `${LFM_BASE}?method=album.getinfo&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}&api_key=${LFM_KEY}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { success: false, error: 'API error' };
    const data = await res.json();
    if (!data.album) return { success: false, error: 'Not found' };

    const lfm = data.album as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    const images = lfm.image as Array<{ '#text': string; size: string }> | undefined;
    const largeImg = images?.find(i => i.size === 'extralarge' || i.size === 'large');
    if (largeImg && !album.image_url) update.image_url = largeImg['#text'];

    const tags = (lfm.tags as { tag: Array<{ name: string; count: number }> } | undefined)?.tag;
    if (tags) {
      const existing = Array.isArray(album.custom_tags) ? album.custom_tags : [];
      const newTags = tags.map(t => t.name).filter((t: string) => !existing.includes(t));
      if (newTags.length) update.custom_tags = [...existing, ...newTags];
      update.lastfm_tags = tags;
    }

    if (lfm.playcount) update.lastfm_playcount = parseInt(lfm.playcount as string);
    if (lfm.listeners) update.lastfm_listeners = parseInt(lfm.listeners as string);
    update.lastfm_url = lfm.url;

    const simUrl = `${LFM_BASE}?method=album.getsimilar&artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}&api_key=${LFM_KEY}&format=json&limit=10`;
    const simRes = await fetch(simUrl);
    if (simRes.ok) {
      const simData = await simRes.json();
      if (simData.similaralbums?.album) {
        update.lastfm_similar_albums = simData.similaralbums.album;
      }
    }

    if (!Object.keys(update).length) return { success: true, skipped: true };
    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: { tags: tags?.length || 0 } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 3. ENHANCED SPOTIFY
// ============================================================================

const SP_ID = process.env.SPOTIFY_CLIENT_ID!;
const SP_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
let spToken: { token: string; exp: number } | null = null;

async function spGetToken(): Promise<string> {
  if (spToken && spToken.exp > Date.now()) return spToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${SP_ID}:${SP_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  spToken = { token: data.access_token, exp: Date.now() + (data.expires_in * 1000) - 60000 };
  return spToken.token;
}

export async function enrichSpotifyEnhanced(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,spotify_id,artist,title').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    let spId = album.spotify_id;
    const token = await spGetToken();

    if (!spId) {
      const q = `album:${album.title} artist:${album.artist}`;
      const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!searchRes.ok) return { success: false, error: 'Search failed' };
      const searchData = await searchRes.json();
      spId = searchData.albums?.items?.[0]?.id;
      if (!spId) return { success: false, error: 'Not found' };
    }

    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${spId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!albumRes.ok) return { success: false, error: 'Fetch failed' };
    const albumData = await albumRes.json();

    const trackIds = albumData.tracks.items.map((t: { id: string }) => t.id).join(',');
    const featRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const features = featRes.ok ? await featRes.json() : null;

    const update: Record<string, unknown> = {
      spotify_id: spId,
      spotify_url: albumData.external_urls.spotify,
      spotify_popularity: albumData.popularity,
      spotify_release_date: albumData.release_date,
      spotify_release_date_precision: albumData.release_date_precision,
      spotify_total_tracks: albumData.total_tracks,
      spotify_image_url: albumData.images?.[0]?.url,
      spotify_available_markets: albumData.available_markets,
    };

    if (features?.audio_features) {
      const valid = features.audio_features.filter((f: unknown) => f !== null);
      if (valid.length) {
        const avg = (key: string) => {
          const vals = valid.map((f: Record<string, number>) => f[key]).filter((v: number) => v != null);
          return vals.length ? vals.reduce((a: number, b: number) => a + b) / vals.length : null;
        };
        update.spotify_danceability = avg('danceability');
        update.spotify_energy = avg('energy');
        update.spotify_valence = avg('valence');
        update.spotify_tempo = avg('tempo');
        update.spotify_acousticness = avg('acousticness');
        update.spotify_instrumentalness = avg('instrumentalness');
        update.spotify_liveness = avg('liveness');
        update.spotify_speechiness = avg('speechiness');
        update.spotify_loudness = avg('loudness');
      }
    }

    update.spotify_tracks = albumData.tracks.items.map((t: Record<string, unknown>) => ({
      position: String(t.track_number),
      title: t.name,
      duration: Math.floor((t.duration_ms as number) / 1000),
      artist: ((t.artists as Array<{ name: string }>)[0]).name,
      isrc: t.external_ids ? ((t.external_ids as Record<string, string>).isrc) : undefined,
      preview_url: t.preview_url,
    }));

    const totalDur = albumData.tracks.items.reduce((s: number, t: { duration_ms: number }) => s + t.duration_ms, 0);
    update.length_seconds = Math.floor(totalDur / 1000);

    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: update };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 4. ENHANCED APPLE MUSIC
// ============================================================================

const AM_TOKEN = process.env.APPLE_MUSIC_TOKEN!;

export async function enrichAppleMusicEnhanced(albumId: number): Promise<EnrichmentResult> {
  try {
    if (!AM_TOKEN) return { success: false, error: 'Token not configured' };
    const { data: album } = await supabase.from('collection')
      .select('id,apple_music_id,artist,title').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    let amId = album.apple_music_id;
    if (!amId) {
      const q = `${album.artist} ${album.title}`;
      const searchRes = await fetch(`https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(q)}&types=albums&limit=1`, {
        headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
      });
      if (!searchRes.ok) return { success: false, error: 'Search failed' };
      const searchData = await searchRes.json();
      amId = searchData.results?.albums?.data?.[0]?.id;
      if (!amId) return { success: false, error: 'Not found' };
    }

    const albumRes = await fetch(`https://api.music.apple.com/v1/catalog/us/albums/${amId}`, {
      headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
    });
    if (!albumRes.ok) return { success: false, error: 'Fetch failed' };
    const albumData = await albumRes.json();
    const attrs = albumData.data[0].attributes;

    const update: Record<string, unknown> = {
      apple_music_id: amId,
      apple_music_url: attrs.url,
      apple_music_artwork_url: attrs.artwork?.url,
      apple_music_composer: attrs.composerName,
      apple_music_genre_names: attrs.genreNames,
      apple_music_release_date: attrs.releaseDate,
      apple_music_record_label: attrs.recordLabel,
      apple_music_copyright: attrs.copyright,
      apple_music_editorial_notes: attrs.editorialNotes?.standard,
    };

    const tracksRes = await fetch(`https://api.music.apple.com/v1/catalog/us/albums/${amId}/tracks`, {
      headers: { 'Authorization': `Bearer ${AM_TOKEN}` }
    });
    if (tracksRes.ok) {
      const tracksData = await tracksRes.json();
      update.apple_music_tracks = tracksData.data.map((t: Record<string, Record<string, unknown>>) => ({
        position: String(t.attributes.trackNumber),
        title: t.attributes.name,
        duration: Math.floor((t.attributes.durationInMillis as number) / 1000),
        composer: t.attributes.composerName,
        isrc: t.attributes.isrc,
      }));
    }

    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: update };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 5. ALLMUSIC
// ============================================================================

export async function enrichAllMusic(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,artist,title,allmusic_id').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    if (album.allmusic_id) return { success: true, skipped: true };

    const searchUrl = `https://www.allmusic.com/search/albums/${encodeURIComponent(album.artist + ' ' + album.title)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return { success: false, error: 'Search failed' };
    const searchHtml = await searchRes.text();

    const linkMatch = searchHtml.match(/href="(\/album\/[^"]+)"/);
    if (!linkMatch) return { success: false, error: 'Not found' };

    const albumPath = linkMatch[1];
    const albumUrl = `https://www.allmusic.com${albumPath}`;
    const albumRes = await fetch(albumUrl);
    if (!albumRes.ok) return { success: false, error: 'Fetch failed' };
    const html = await albumRes.text();

    const update: Record<string, unknown> = {
      allmusic_id: albumPath.split('/').pop(),
      allmusic_url: albumUrl,
    };

    const ratingMatch = html.match(/class="rating-allmusic-(\d)"/);
    if (ratingMatch) update.allmusic_rating = parseInt(ratingMatch[1]);

    const reviewMatch = html.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/);
    if (reviewMatch) {
      const review = reviewMatch[1].replace(/<[^>]*>/g, '').trim();
      update.allmusic_review = review.substring(0, 5000);
    }

    const stylesMatch = html.match(/Styles<\/span>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/);
    if (stylesMatch) {
      const styles = Array.from(stylesMatch[1].matchAll(/>([\w\s-]+)</g)).map(m => m[1].trim());
      update.allmusic_styles = styles;
    }

    const moodsMatch = html.match(/Album Moods<\/span>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/);
    if (moodsMatch) {
      const moods = Array.from(moodsMatch[1].matchAll(/>([\w\s-]+)</g)).map(m => m[1].trim());
      update.allmusic_moods = moods;
    }

    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: update };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 6. WIKIPEDIA / DBPEDIA
// ============================================================================

export async function enrichWikipedia(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,artist,title,wikipedia_url').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    if (album.wikipedia_url) return { success: true, skipped: true };

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(album.artist + ' ' + album.title + ' album')}&format=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return { success: false, error: 'Search failed' };
    const searchData = await searchRes.json();

    if (!searchData.query?.search?.length) return { success: false, error: 'Not found' };
    const pageId = searchData.query.search[0].pageid;

    const pageUrl = `https://en.wikipedia.org/w/api.php?action=parse&pageid=${pageId}&format=json&prop=text`;
    const pageRes = await fetch(pageUrl);
    if (!pageRes.ok) return { success: false, error: 'Page fetch failed' };
    const pageData = await pageRes.json();
    const html = pageData.parse.text['*'];

    const update: Record<string, unknown> = {
      wikipedia_url: `https://en.wikipedia.org/?curid=${pageId}`,
      dbpedia_uri: `http://dbpedia.org/resource/${pageData.parse.title.replace(/ /g, '_')}`,
    };

    const certMatch = html.matchAll(/(?:Gold|Platinum|Diamond)[\s\S]{0,50}?(\w+)/g);
    const certs: Array<{ region: string; cert: string }> = [];
    for (const match of certMatch) {
      if (match[1]) certs.push({ region: match[1], cert: match[0].split(' ')[0] });
    }
    if (certs.length) update.certifications = certs;

    const chartMatch = html.matchAll(/(\w+ \d+|Billboard \d+)[\s\S]{0,30}?(?:No\.|#)?\s*(\d+)/g);
    const charts: Array<{ chart: string; position: number }> = [];
    for (const match of chartMatch) {
      if (match[1] && match[2]) charts.push({ chart: match[1], position: parseInt(match[2]) });
    }
    if (charts.length) update.chart_positions = charts;

    const locMatch = html.match(/Recorded[\s\S]{0,200}?at\s+([^<]+)/i);
    if (locMatch) update.recording_location = locMatch[1].trim();

    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: update };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 7. COVER ART ARCHIVE
// ============================================================================

export async function enrichCoverArtArchive(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,musicbrainz_id,image_url,back_image_url').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    if (!album.musicbrainz_id) return { success: false, error: 'No MusicBrainz ID' };
    if (album.back_image_url) return { success: true, skipped: true };

    const images = await caaGet(album.musicbrainz_id);
    if (!images?.length) return { success: false, error: 'No images found' };

    const update: Record<string, unknown> = {};
    const front = images.find(i => i.front === true);
    const back = images.find(i => i.back === true);
    const spine = images.filter(i => (i.types as string[]).includes('Spine'));
    const medium = images.filter(i => (i.types as string[]).includes('Medium'));

    if (front && !album.image_url) update.image_url = front.image;
    if (back && !album.back_image_url) update.back_image_url = back.image;
    if (spine.length) update.spine_image_url = spine[0].image;
    if (medium.length) update.vinyl_label_images = medium.map(m => m.image);

    if (!Object.keys(update).length) return { success: true, skipped: true };
    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: { images: images.length } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 8. ACOUSTICBRAINZ
// ============================================================================

export async function enrichAcousticBrainz(albumId: number): Promise<EnrichmentResult> {
  try {
    const { data: album } = await supabase.from('collection')
      .select('id,musicbrainz_id,tempo_bpm').eq('id', albumId).single();
    if (!album) return { success: false, error: 'Album not found' };

    if (!album.musicbrainz_id) return { success: false, error: 'No MusicBrainz ID' };
    if (album.tempo_bpm) return { success: true, skipped: true };

    const release = await mbGetRelease(album.musicbrainz_id);
    if (!release) return { success: false, error: 'Release not found' };

    const tempos: number[] = [];
    const keys: string[] = [];
    let danceSum = 0;
    const energySum = 0;
    let acousticSum = 0, aggressiveSum = 0;
    let electronicSum = 0, happySum = 0, partySum = 0, relaxedSum = 0, sadSum = 0, cnt = 0;

    const media = release.media as Array<{ tracks?: Array<{ recording?: { id: string } }> }> | undefined;
    if (media) {
      for (const medium of media) {
        if (!medium.tracks) continue;
        for (const track of medium.tracks) {
          if (!track.recording?.id) continue;
          const low = await abLowLevel(track.recording.id);
          const high = await abHighLevel(track.recording.id);

          if (low?.rhythm) {
            const bpm = (low.rhythm as Record<string, unknown>).bpm as number | undefined;
            if (bpm) tempos.push(bpm);
          }
          if (low?.tonal) {
            const tonal = low.tonal as Record<string, unknown>;
            if (tonal.key_key && tonal.key_scale) {
              keys.push(`${tonal.key_key} ${tonal.key_scale}`);
            }
          }

          if (high?.highlevel) {
            const hl = high.highlevel as Record<string, Record<string, Record<string, number>>>;
            if (hl.danceability?.all?.danceable) { danceSum += hl.danceability.all.danceable; cnt++; }
            if (hl.mood_acoustic?.all?.acoustic) acousticSum += hl.mood_acoustic.all.acoustic;
            if (hl.mood_aggressive?.all?.aggressive) aggressiveSum += hl.mood_aggressive.all.aggressive;
            if (hl.mood_electronic?.all?.electronic) electronicSum += hl.mood_electronic.all.electronic;
            if (hl.mood_happy?.all?.happy) happySum += hl.mood_happy.all.happy;
            if (hl.mood_party?.all?.party) partySum += hl.mood_party.all.party;
            if (hl.mood_relaxed?.all?.relaxed) relaxedSum += hl.mood_relaxed.all.relaxed;
            if (hl.mood_sad?.all?.sad) sadSum += hl.mood_sad.all.sad;
          }

          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    const update: Record<string, unknown> = {};
    if (tempos.length) update.tempo_bpm = Math.round(tempos.reduce((a, b) => a + b) / tempos.length);
    if (keys.length) {
      const kc: Record<string, number> = {};
      keys.forEach(k => kc[k] = (kc[k] || 0) + 1);
      update.musical_key = Object.entries(kc).sort((a, b) => b[1] - a[1])[0][0];
    }
    if (cnt > 0) {
      update.danceability = danceSum / cnt;
      update.energy = energySum / cnt;
      update.mood_acoustic = acousticSum / cnt;
      update.mood_aggressive = aggressiveSum / cnt;
      update.mood_electronic = electronicSum / cnt;
      update.mood_happy = happySum / cnt;
      update.mood_party = partySum / cnt;
      update.mood_relaxed = relaxedSum / cnt;
      update.mood_sad = sadSum / cnt;
    }

    if (!Object.keys(update).length) return { success: false, error: 'No data found' };
    await supabase.from('collection').update(update).eq('id', albumId);
    return { success: true, data: update };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

// ============================================================================
// 9. EXISTING SERVICES (CALL EXISTING ROUTES - FIXED SIGNATURES)
// ============================================================================

export async function enrichGenius(albumId: number): Promise<EnrichmentResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const res = await fetch(`${baseUrl}/api/enrich-sources/genius`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

export async function enrichDiscogsMetadata(albumId: number): Promise<EnrichmentResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const res = await fetch(`${baseUrl}/api/enrich-sources/discogs-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

export async function enrichDiscogsTracklist(albumId: number): Promise<EnrichmentResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const res = await fetch(`${baseUrl}/api/enrich-sources/discogs-tracklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumId })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}