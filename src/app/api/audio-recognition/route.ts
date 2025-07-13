// src/app/api/audio-recognition/route.ts - Enhanced to pull candidates from ALL services
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
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
  source_priority?: number; // For ranking results
}

// Enhanced recognition result interface
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

// Enhanced collection matching with fuzzy search
async function findAllCollectionMatches(artist: string, title: string, album?: string): Promise<CollectionMatch[]> {
  try {
    console.log(`🔍 Comprehensive collection search for: ${artist} - ${title}${album ? ` (${album})` : ''}`);
    
    const allMatches: CollectionMatch[] = [];
    
    // 1. Exact artist match
    const { data: exactArtist } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('artist', artist)
      .limit(3);
    
    if (exactArtist) allMatches.push(...exactArtist);
    
    // 2. Fuzzy artist matching (split words)
    const artistWords = artist.toLowerCase().split(' ').filter(word => word.length > 2);
    for (const word of artistWords.slice(0, 2)) { // Limit to prevent too many queries
      const { data: fuzzyArtist } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('artist', `%${word}%`)
        .limit(2);
      
      if (fuzzyArtist) allMatches.push(...fuzzyArtist);
    }
    
    // 3. Album title search if available
    if (album) {
      const { data: albumMatches } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('title', `%${album}%`)
        .limit(2);
      
      if (albumMatches) allMatches.push(...albumMatches);
    }
    
    // 4. Track title search (in case track title matches album title in collection)
    const { data: titleMatches } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('title', `%${title}%`)
      .limit(2);
    
    if (titleMatches) allMatches.push(...titleMatches);
    
    // Remove duplicates by ID
    const uniqueMatches = allMatches.filter((match, index, self) => 
      index === self.findIndex(m => m.id === match.id)
    );
    
    console.log(`✅ Found ${uniqueMatches.length} collection matches`);
    return uniqueMatches.slice(0, 5); // Limit to top 5
    
  } catch (error) {
    console.error('Collection matching error:', error);
    return [];
  }
}

// Enhanced artwork search
async function searchForArtwork(artist: string, album?: string): Promise<string | undefined> {
  try {
    // Try Spotify first
    const spotifyArtwork = await searchSpotifyArtwork(artist, album);
    if (spotifyArtwork) return spotifyArtwork;
    
    // Try Last.fm as fallback
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

// ENHANCED: Search Spotify for additional candidates
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
      title: track.name,
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

// ENHANCED: Search Last.fm for additional candidates
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
      title: track.name || title,
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
          title: track.title || 'Unknown Title',
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
        title: data.result.title || 'Unknown Title',
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

// Main POST handler for enhanced multi-service audio recognition
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

    console.log(`🎵 Starting COMPREHENSIVE recognition for: ${audioFile.name}`);

    // PHASE 1: Audio Recognition Services (parallel execution)
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

    // Select primary track from audio recognition (highest confidence)
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

    // PHASE 2: Comprehensive candidate gathering
    console.log('🔍 Phase 2: Gathering candidates from ALL sources...');
    
    const candidatePromises = [
      // Collection matches
      findAllCollectionMatches(primaryTrack.artist, primaryTrack.title, primaryTrack.album),
      // Spotify search
      searchSpotifyTracks(primaryTrack.artist, primaryTrack.title),
      // Last.fm search  
      searchLastFmTracks(primaryTrack.artist, primaryTrack.title)
    ];

    const [collectionMatches, spotifyTracks, lastfmTracks] = await Promise.allSettled(candidatePromises);
    
    // PHASE 3: Process and enhance all candidates
    console.log('⚡ Phase 3: Processing and enhancing candidates...');
    
    const allCandidates: EnhancedRecognitionTrack[] = [...allAudioCandidates];
    
    // Add collection-based candidates
    if (collectionMatches.status === 'fulfilled') {
      const collectionCandidates = collectionMatches.value.map((match): EnhancedRecognitionTrack => ({
        artist: match.artist,
        title: match.title, // This is the album title in collection
        album: match.title,
        image_url: match.image_url,
        confidence: 0.85, // High confidence for collection matches
        service: 'Collection Match',
        source_priority: 0, // Highest priority
        collection_match: match, // This is the correct CollectionMatch type
        is_guest_vinyl: false
      }));
      allCandidates.push(...collectionCandidates);
      console.log(`📀 Added ${collectionCandidates.length} collection candidates`);
    }
    
    // Add Spotify candidates
    if (spotifyTracks.status === 'fulfilled') {
      allCandidates.push(...spotifyTracks.value);
      console.log(`🎶 Added ${spotifyTracks.value.length} Spotify candidates`);
    }
    
    // Add Last.fm candidates
    if (lastfmTracks.status === 'fulfilled') {
      allCandidates.push(...lastfmTracks.value);
      console.log(`🎵 Added ${lastfmTracks.value.length} Last.fm candidates`);
    }

    // PHASE 4: Enhance primary track with collection info
    console.log('🔧 Phase 4: Enhancing primary track...');
    
    const primaryCollectionMatch = collectionMatches.status === 'fulfilled' 
      ? collectionMatches.value.find((match: CollectionMatch) => 
          match.artist.toLowerCase().includes(primaryTrack.artist.toLowerCase()) ||
          primaryTrack.artist.toLowerCase().includes(match.artist.toLowerCase())
        )
      : null;

    if (primaryCollectionMatch) {
      primaryTrack.collection_match = primaryCollectionMatch; // Correctly typed as CollectionMatch
      primaryTrack.is_guest_vinyl = false;
      if (!primaryTrack.image_url && primaryCollectionMatch.image_url) {
        primaryTrack.image_url = primaryCollectionMatch.image_url;
      }
      console.log(`✅ Primary track matched to collection: ${primaryCollectionMatch.artist} - ${primaryCollectionMatch.title}`);
    } else {
      primaryTrack.is_guest_vinyl = true;
      // Try to get artwork from search APIs
      if (!primaryTrack.image_url) {
        primaryTrack.image_url = await searchForArtwork(primaryTrack.artist, primaryTrack.album);
      }
      console.log(`👤 Primary track marked as guest vinyl`);
    }

    // PHASE 5: Deduplicate and rank candidates
    console.log('📊 Phase 5: Ranking and deduplicating candidates...');
    
    // Remove primary track from candidates to avoid duplication
    const otherCandidates = allCandidates.filter(candidate => 
      !(candidate.artist === primaryTrack.artist && 
        candidate.title === primaryTrack.title && 
        candidate.service === primaryTrack.service)
    );
    
    // Sort by priority and confidence
    const rankedCandidates = otherCandidates
      .sort((a, b) => {
        // First by source priority (0 = collection, 1 = ACRCloud, etc.)
        if (a.source_priority !== b.source_priority) {
          return (a.source_priority || 999) - (b.source_priority || 999);
        }
        // Then by confidence
        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, 15); // Limit to 15 candidates
    
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
          title: primaryTrack.title,
          album_title: primaryTrack.album,
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
      'Collection Search',
      'Spotify Search',
      'Last.fm Search'
    ].filter(service => {
      // Only include services that are actually configured
      switch (service) {
        case 'ACRCloud': return !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY);
        case 'AudD': return !!process.env.AUDD_API_TOKEN;
        case 'Spotify Search': return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
        case 'Last.fm Search': return !!process.env.LASTFM_API_KEY;
        default: return true;
      }
    });

    console.log(`🎉 Recognition complete! Primary: ${primaryTrack.service}, Candidates: ${rankedCandidates.length}, Services: ${servicesQueried.length}`);

    return NextResponse.json({
      success: true,
      track: primaryTrack,
      candidates: rankedCandidates,
      servicesQueried,
      totalCandidatesFound: allCandidates.length,
      albumContextUsed: false, // You can implement album context logic here
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
      name: 'Collection Search',
      enabled: true,
      priority: 0
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
    message: 'Comprehensive Multi-Service Audio Recognition API',
    version: '2.0.0',
    enabledServices: enabledServices.map(s => `${s.name} (Priority: ${s.priority})`),
    features: [
      'Parallel querying of ALL available services',
      'Comprehensive candidate collection from every source',
      'Smart collection matching with fuzzy search',
      'Priority-based result ranking',
      'Enhanced artwork discovery',
      'No early stopping - queries everything',
      'Detailed service reporting'
    ],
    serviceDetails: {
      audioRecognition: ['ACRCloud', 'AudD'],
      searchAPIs: ['Spotify', 'Last.fm'],
      internal: ['Collection Search'],
      total: enabledServices.length
    }
  });
}