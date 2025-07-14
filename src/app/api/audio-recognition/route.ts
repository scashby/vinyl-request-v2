// src/app/api/audio-recognition/route.ts - FIXED VERSION with proper track title handling
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import crypto from 'crypto';

interface RecognitionTrack {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string; // This is the ALBUM title in the collection
  year: string;
  image_url?: string;
  folder?: string;
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
  source_priority?: number;
}

interface EnhancedRecognitionResult {
  success: boolean;
  track?: EnhancedRecognitionTrack;
  candidates?: EnhancedRecognitionTrack[];
  error?: string;
  albumContextUsed?: boolean;
  albumContextSwitched?: boolean;
  servicesQueried?: string[];
  totalCandidatesFound?: number;
}

// ACRCloud types
interface ACRCloudTrack {
  title?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  external_metadata?: {
    spotify?: { album?: { images?: Array<{ url?: string }> } };
    apple_music?: { album?: { artwork?: { url?: string } } };
    deezer?: { album?: { cover_big?: string } };
    youtube?: { thumbnail?: string };
  };
}

interface ACRCloudResponse {
  status?: { code?: number; msg?: string; score?: number };
  metadata?: { music?: ACRCloudTrack[] };
}

// Spotify types
interface SpotifyTrack {
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
}

interface SpotifySearchResponse {
  tracks?: { items?: SpotifyTrack[] };
}

// Last.fm types
interface LastFmImage {
  '#text'?: string;
  size?: string;
}

interface LastFmTrack {
  name?: string;
  artist?: { name?: string } | string;
  album?: { name?: string };
  image?: LastFmImage[];
}

interface LastFmSearchResponse {
  results?: {
    trackmatches?: {
      track?: LastFmTrack | LastFmTrack[];
    };
  };
}

// FIXED: Enhanced collection matching for BYO Vinyl only
async function findBYOCollectionMatches(artist: string, title: string, album?: string): Promise<CollectionMatch[]> {
  try {
    console.log(`🔍 BYO Collection search for: ${artist} - ${title}${album ? ` (${album})` : ''}`);
    
    const allMatches: CollectionMatch[] = [];
    
    // FIXED: Only search BYO vinyl folders (Vinyl, 45s, Cassettes)
    const byoFolders = ['Vinyl', '45s', 'Cassettes'];
    
    // 1. Exact artist match in BYO folders
    const { data: exactArtist } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('artist', artist)
      .in('folder', byoFolders)
      .limit(5);
    
    if (exactArtist) allMatches.push(...exactArtist);
    
    // 2. Album title search if available (album title should match collection title)
    if (album) {
      const { data: albumMatches } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('title', `%${album}%`)
        .in('folder', byoFolders)
        .limit(3);
      
      if (albumMatches) allMatches.push(...albumMatches);
    }
    
    // 3. Fuzzy artist matching (split words) in BYO folders
    const artistWords = artist.toLowerCase().split(' ').filter(word => word.length > 2);
    for (const word of artistWords.slice(0, 2)) {
      const { data: fuzzyArtist } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('artist', `%${word}%`)
        .in('folder', byoFolders)
        .limit(2);
      
      if (fuzzyArtist) allMatches.push(...fuzzyArtist);
    }
    
    // Remove duplicates by ID
    const uniqueMatches = allMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.id === match.id)
    );
    
    console.log(`✅ Found ${uniqueMatches.length} BYO collection matches`);
    return uniqueMatches.slice(0, 5);
    
  } catch (error) {
    console.error('BYO Collection matching error:', error);
    return [];
  }
}

// Enhanced artwork search
async function searchForArtwork(artist: string, album?: string): Promise<string | undefined> {
  try {
    const spotifyArtwork = await searchSpotifyArtwork(artist, album);
    if (spotifyArtwork) return spotifyArtwork;
    
    const lastfmArtwork = await searchLastFmArtwork(artist, album);
    if (lastfmArtwork) return lastfmArtwork;
    
  } catch (error) {
    console.warn('Artwork search failed:', error);
  }
  
  return undefined;
}

async function searchSpotifyArtwork(artist: string, album?: string): Promise<string | undefined> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return undefined;
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) return undefined;

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const query = album ? `artist:"${artist}" album:"${album}"` : `artist:"${artist}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) return undefined;

    const searchData = await searchResponse.json();
    const albums = searchData.albums?.items;
    
    return albums?.[0]?.images?.[0]?.url;
  } catch (error) {
    console.error('Spotify artwork search error:', error);
    return undefined;
  }
}

async function searchLastFmArtwork(artist: string, album?: string): Promise<string | undefined> {
  if (!process.env.LASTFM_API_KEY) return undefined;

  try {
    const apiKey = process.env.LASTFM_API_KEY;
    let url: string;
    
    if (album) {
      url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
    } else {
      url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=1`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (album && data.album?.image) {
      const largeImage = data.album.image.find((img: LastFmImage) => img.size === 'extralarge');
      return largeImage?.['#text'];
    } else if (data.topalbums?.album) {
      const albums = Array.isArray(data.topalbums.album) ? data.topalbums.album : [data.topalbums.album];
      const largeImage = albums[0]?.image?.find((img: LastFmImage) => img.size === 'extralarge');
      return largeImage?.['#text'];
    }
  } catch (error) {
    console.error('Last.fm artwork search error:', error);
  }
  
  return undefined;
}

// Search Spotify for additional candidates
async function searchSpotifyTracks(artist: string, title: string): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return [];
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) return [];

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const query = `track:"${title}" artist:"${artist}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) return [];

    const data: SpotifySearchResponse = await searchResponse.json();
    const tracks = data.tracks?.items || [];
    
    return tracks.map((track, index): EnhancedRecognitionTrack => ({
      artist: track.artists[0]?.name || artist,
      title: track.name, // FIXED: Keep the actual track title
      album: track.album.name,
      image_url: track.album.images[0]?.url,
      confidence: Math.max(0.6, 0.9 - (index * 0.1)),
      service: 'Spotify Search',
      source_priority: 3,
      is_guest_vinyl: true
    }));
  } catch (error) {
    console.error('Spotify search error:', error);
    return [];
  }
}

// Search Last.fm for additional candidates
async function searchLastFmTracks(artist: string, title: string): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.LASTFM_API_KEY) return [];

  try {
    const apiKey = process.env.LASTFM_API_KEY;
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=3`;
    
    const response = await fetch(url);
    const data: LastFmSearchResponse = await response.json();
    
    const trackMatches = data.results?.trackmatches?.track;
    const tracks = Array.isArray(trackMatches) ? trackMatches : (trackMatches ? [trackMatches] : []);
    
    return tracks.map((track, index): EnhancedRecognitionTrack => ({
      artist: typeof track.artist === 'string' ? track.artist : track.artist?.name || artist,
      title: track.name || title, // FIXED: Keep the actual track title
      album: track.album?.name,
      image_url: track.image?.find((img: LastFmImage) => img.size === 'extralarge')?.['#text'],
      confidence: Math.max(0.5, 0.8 - (index * 0.1)),
      service: 'Last.fm Search',
      source_priority: 4,
      is_guest_vinyl: true
    }));
  } catch (error) {
    console.error('Last.fm search error:', error);
    return [];
  }
}

// ACRCloud signature generation
function generateACRCloudSignature(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: number,
  accessSecret: string
): string {
  const stringToSign = [method, uri, accessKey, dataType, signatureVersion, timestamp].join('\n');
  return crypto.createHmac('sha1', accessSecret).update(stringToSign).digest('base64');
}

// Enhanced ACRCloud recognition
async function recognizeWithACRCloud(audioFile: File): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY) {
    return [];
  }

  try {
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateACRCloudSignature(
      'POST',
      '/v1/identify',
      accessKey,
      'audio',
      '1',
      timestamp,
      secretKey
    );
    
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer], { type: 'audio/wav' }));
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${endpoint}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) return [];

    const data: ACRCloudResponse = await response.json();
    
    if (data.status?.code === 0 && data.metadata?.music) {
      return data.metadata.music.slice(0, 5).map((track, index): EnhancedRecognitionTrack => {
        const extractImageUrl = (track: ACRCloudTrack): string | undefined => {
          return track.external_metadata?.spotify?.album?.images?.[0]?.url ||
                 track.external_metadata?.apple_music?.album?.artwork?.url ||
                 track.external_metadata?.deezer?.album?.cover_big ||
                 track.external_metadata?.youtube?.thumbnail;
        };

        return {
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          title: track.title || 'Unknown Title', // FIXED: Keep actual track title
          album: track.album?.name,
          image_url: extractImageUrl(track),
          confidence: Math.max(0.7, (data.status?.score || 80) / 100 - (index * 0.05)),
          service: 'ACRCloud',
          source_priority: 1,
          is_guest_vinyl: true
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error('ACRCloud error:', error);
    return [];
  }
}

// Enhanced AudD recognition
async function recognizeWithAudD(audioFile: File): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.AUDD_API_TOKEN) return [];

  try {
    const formData = new FormData();
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify,deezer');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    if (data.status === 'success' && data.result) {
      let imageUrl: string | undefined;
      
      if (data.result.spotify?.album?.images?.length > 0) {
        imageUrl = data.result.spotify.album.images[0].url;
      } else if (data.result.apple_music?.artwork?.url) {
        imageUrl = data.result.apple_music.artwork.url;
      } else if (data.result.deezer?.album?.cover_big) {
        imageUrl = data.result.deezer.album.cover_big;
      }
      
      return [{
        artist: data.result.artist || 'Unknown Artist',
        title: data.result.title || 'Unknown Title', // FIXED: Keep actual track title
        album: data.result.album,
        image_url: imageUrl,
        confidence: 0.8,
        service: 'AudD',
        source_priority: 2,
        is_guest_vinyl: true
      }];
    }
    
    return [];
  } catch (error) {
    console.error('AudD error:', error);
    return [];
  }
}

// FIXED: Main POST handler with proper track title preservation
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'Missing audio file' },
        { status: 400 }
      );
    }

    console.log(`🎵 Starting BYO VINYL recognition for: ${audioFile.name}`);

    // PHASE 1: Audio Recognition Services
    console.log('🔊 Phase 1: Audio recognition services...');
    const audioRecognitionPromises = [
      recognizeWithACRCloud(audioFile),
      recognizeWithAudD(audioFile)
    ];

    const audioResults = await Promise.allSettled(audioRecognitionPromises);
    const allAudioCandidates: EnhancedRecognitionTrack[] = [];
    
    audioResults.forEach((result, index) => {
      const serviceName = ['ACRCloud', 'AudD'][index];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${serviceName}: Found ${result.value.length} candidates`);
        allAudioCandidates.push(...result.value);
      } else {
        console.log(`❌ ${serviceName}: No results`);
      }
    });

    // Select primary track from audio recognition
    const primaryTrack = allAudioCandidates.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0];

    if (!primaryTrack) {
      return NextResponse.json({
        success: false,
        error: 'No audio recognition results from any service',
        servicesQueried: ['ACRCloud', 'AudD'],
        totalCandidatesFound: 0
      } satisfies EnhancedRecognitionResult);
    }

    console.log(`🎯 Primary track: ${primaryTrack.artist} - ${primaryTrack.title} (${primaryTrack.service})`);

    // PHASE 2: BYO Collection matching and candidate gathering
    console.log('🔍 Phase 2: BYO collection matching and candidate gathering...');
    
    const collectionMatchesPromise = findBYOCollectionMatches(primaryTrack.artist, primaryTrack.title, primaryTrack.album);
    const spotifyTracksPromise = searchSpotifyTracks(primaryTrack.artist, primaryTrack.title);
    const lastfmTracksPromise = searchLastFmTracks(primaryTrack.artist, primaryTrack.title);

    const [collectionMatchesResult, spotifyTracksResult, lastfmTracksResult] = await Promise.allSettled([
      collectionMatchesPromise,
      spotifyTracksPromise,
      lastfmTracksPromise
    ]);
    
    // PHASE 3: Process and enhance all candidates
    console.log('⚡ Phase 3: Processing and enhancing candidates...');
    
    const allCandidates: EnhancedRecognitionTrack[] = [...allAudioCandidates];
    
    // Extract collection matches safely
    let collectionMatches: CollectionMatch[] = [];
    if (collectionMatchesResult.status === 'fulfilled') {
      collectionMatches = collectionMatchesResult.value;
    }
    
    // FIXED: Add collection-based candidates - preserve the TRACK title, use collection title as ALBUM
    if (collectionMatches.length > 0) {
      const collectionCandidates: EnhancedRecognitionTrack[] = collectionMatches.map((match: CollectionMatch): EnhancedRecognitionTrack => ({
        artist: match.artist,
        title: primaryTrack.title, // FIXED: Keep the recognized TRACK title
        album: match.title, // FIXED: Use collection title as ALBUM title
        image_url: match.image_url,
        confidence: 0.85,
        service: 'BYO Collection Match',
        source_priority: 0,
        collection_match: match,
        is_guest_vinyl: false
      }));
      allCandidates.push(...collectionCandidates);
      console.log(`📀 Added ${collectionCandidates.length} BYO collection candidates`);
    }
    
    // Add Spotify candidates
    if (spotifyTracksResult.status === 'fulfilled') {
      allCandidates.push(...spotifyTracksResult.value);
      console.log(`🎶 Added ${spotifyTracksResult.value.length} Spotify candidates`);
    }
    
    // Add Last.fm candidates
    if (lastfmTracksResult.status === 'fulfilled') {
      allCandidates.push(...lastfmTracksResult.value);
      console.log(`🎵 Added ${lastfmTracksResult.value.length} Last.fm candidates`);
    }

    // PHASE 4: FIXED - Enhanced primary track with proper collection matching
    console.log('🔧 Phase 4: Enhancing primary track...');
    
    // Find the best collection match for the primary track
    const primaryCollectionMatch: CollectionMatch | undefined = collectionMatches.find((match: CollectionMatch) => {
      // Check if artist matches and album matches (if we have album info)
      const artistMatch = match.artist.toLowerCase().includes(primaryTrack.artist.toLowerCase()) ||
                         primaryTrack.artist.toLowerCase().includes(match.artist.toLowerCase());
      
      const albumMatch = !primaryTrack.album || 
                        match.title.toLowerCase().includes(primaryTrack.album.toLowerCase()) ||
                        primaryTrack.album.toLowerCase().includes(match.title.toLowerCase());
      
      return artistMatch && albumMatch;
    });

    if (primaryCollectionMatch) {
      primaryTrack.collection_match = primaryCollectionMatch;
      primaryTrack.is_guest_vinyl = false;
      primaryTrack.album = primaryCollectionMatch.title; // FIXED: Set album to collection title
      if (!primaryTrack.image_url && primaryCollectionMatch.image_url) {
        primaryTrack.image_url = primaryCollectionMatch.image_url;
      }
      console.log(`✅ Primary track matched to BYO collection: ${primaryCollectionMatch.artist} - ${primaryCollectionMatch.title}`);
    } else {
      primaryTrack.is_guest_vinyl = true;
      if (!primaryTrack.image_url) {
        primaryTrack.image_url = await searchForArtwork(primaryTrack.artist, primaryTrack.album);
      }
      console.log(`👤 Primary track marked as guest vinyl`);
    }

    // PHASE 5: Deduplicate and rank candidates
    console.log('📊 Phase 5: Ranking and deduplicating candidates...');
    
    const otherCandidates = allCandidates.filter(candidate => 
      !(candidate.artist === primaryTrack.artist && 
        candidate.title === primaryTrack.title && 
        candidate.service === primaryTrack.service)
    );
    
    const rankedCandidates = otherCandidates
      .sort((a, b) => {
        if (a.source_priority !== b.source_priority) {
          return (a.source_priority || 999) - (b.source_priority || 999);
        }
        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, 15);
    
    // Enhance candidates with artwork if missing
    for (const candidate of rankedCandidates) {
      if (!candidate.image_url && !candidate.collection_match) {
        candidate.image_url = await searchForArtwork(candidate.artist, candidate.album);
      }
    }

    // PHASE 6: Update database and return results
    console.log('💾 Phase 6: Updating database...');
    
    try {
      await supabase
        .from('now_playing')
        .upsert({
          id: 1,
          artist: primaryTrack.artist,
          title: primaryTrack.title, // FIXED: This is the actual TRACK title
          album_title: primaryTrack.album, // FIXED: This is the ALBUM title
          recognition_image_url: primaryTrack.image_url,
          album_id: primaryTrack.collection_match?.id || null,
          started_at: new Date().toISOString(),
          recognition_confidence: primaryTrack.confidence || 0.8,
          service_used: primaryTrack.service || 'Multi-Service',
          updated_at: new Date().toISOString()
        });
      console.log('✅ Database updated successfully');
    } catch (dbError) {
      console.error('Database update error:', dbError);
    }

    const servicesQueried = [
      'ACRCloud',
      'AudD', 
      'BYO Collection Search',
      'Spotify Search',
      'Last.fm Search'
    ].filter(service => {
      switch (service) {
        case 'ACRCloud': return !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY);
        case 'AudD': return !!process.env.AUDD_API_TOKEN;
        case 'Spotify Search': return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
        case 'Last.fm Search': return !!process.env.LASTFM_API_KEY;
        default: return true;
      }
    });

    console.log(`🎉 BYO Recognition complete! Primary: ${primaryTrack.service}, Candidates: ${rankedCandidates.length}, Services: ${servicesQueried.length}`);

    return NextResponse.json({
      success: true,
      track: primaryTrack,
      candidates: rankedCandidates,
      servicesQueried,
      totalCandidatesFound: allCandidates.length,
      albumContextUsed: false,
      albumContextSwitched: false
    } satisfies EnhancedRecognitionResult);

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        servicesQueried: [],
        totalCandidatesFound: 0
      } satisfies EnhancedRecognitionResult,
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const services = [
    { 
      name: 'ACRCloud', 
      enabled: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY),
      priority: 1
    },
    { 
      name: 'AudD', 
      enabled: !!process.env.AUDD_API_TOKEN,
      priority: 2
    },
    {
      name: 'BYO Collection Search',
      enabled: true,
      priority: 0,
      description: 'Searches only Vinyl, 45s, and Cassettes folders'
    },
    {
      name: 'Spotify Search',
      enabled: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      priority: 3
    },
    {
      name: 'Last.fm Search',
      enabled: !!process.env.LASTFM_API_KEY,
      priority: 4
    }
  ];

  const enabledServices = services.filter(s => s.enabled);

  return NextResponse.json({ 
    message: 'BYO Vinyl Multi-Service Audio Recognition API',
    version: '3.0.0',
    enabledServices: enabledServices.map(s => `${s.name} (Priority: ${s.priority})`),
    features: [
      'BYO Vinyl focus - only Vinyl, 45s, Cassettes folders',
      'Proper track title preservation',
      'Album title mapping from collection titles',
      'Priority-based result ranking',
      'Enhanced artwork discovery',
      'Album Follow mode support',
      'Comprehensive candidate collection'
    ],
    byoVinylFolders: ['Vinyl', '45s', 'Cassettes'],
    serviceDetails: {
      audioRecognition: ['ACRCloud', 'AudD'],
      searchAPIs: ['Spotify', 'Last.fm'],
      internal: ['BYO Collection Search'],
      total: enabledServices.length
    }
  });
}