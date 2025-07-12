// src/app/api/audio-recognition/route.ts - Enhanced with proper collection matching
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

interface RecognitionResult {
  success: boolean;
  track?: RecognitionTrack & {
    collection_match?: CollectionMatch;
    is_guest_vinyl?: boolean;
  };
  candidates?: RecognitionTrack[]; 
  error?: string;
  albumContextUsed?: boolean;
  albumContextSwitched?: boolean;
}

interface LastFmImage {
  '#text'?: string;
  size?: string;
}

interface LastFmAlbum {
  name: string;
  image?: LastFmImage[];
}

interface LastFmAlbumResponse {
  album?: LastFmAlbum;
  error?: number;
}

interface LastFmTopAlbumsResponse {
  topalbums?: {
    album?: LastFmAlbum | LastFmAlbum[];
  };
}

interface ServiceConfig {
  name: string;
  apiKey: string | undefined;
  enabled: boolean;
}

interface NowPlayingUpdate {
  artist: string;
  title: string;
  album_title?: string;
  recognition_image_url?: string;
  album_id?: number | null;
  started_at: string;
  recognition_confidence: number;
  service_used: string;
  updated_at: string;
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
}

// ACRCloud API response types
interface ACRCloudTrack {
  title?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  external_metadata?: {
    spotify?: {
      album?: {
        images?: Array<{ url?: string }>;
      };
    };
    apple_music?: {
      album?: {
        artwork?: { url?: string };
      };
    };
    deezer?: {
      album?: { cover_big?: string };
    };
    youtube?: {
      thumbnail?: string;
    };
  };
}

interface ACRCloudResponse {
  status?: {
    code?: number;
    msg?: string;
    score?: number;
  };
  metadata?: {
    music?: ACRCloudTrack[];
  };
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

// Enhanced collection matching function
async function findCollectionMatch(artist: string, album?: string): Promise<CollectionMatch | null> {
  try {
    console.log(`Searching collection for: ${artist}${album ? ` - ${album}` : ''}`);
    
    // Try exact matches first
    const { data: exactMatches } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('artist', artist)
      .limit(5);

    if (exactMatches && exactMatches.length > 0) {
      // If we have an album, try to match it too
      if (album) {
        const albumMatch = exactMatches.find(match => 
          match.title.toLowerCase().includes(album.toLowerCase()) ||
          album.toLowerCase().includes(match.title.toLowerCase())
        );
        if (albumMatch) {
          console.log(`✅ Found exact collection match: ${albumMatch.artist} - ${albumMatch.title}`);
          return albumMatch;
        }
      }
      
      // Return best artist match
      console.log(`✅ Found collection artist match: ${exactMatches[0].artist} - ${exactMatches[0].title}`);
      return exactMatches[0];
    }

    // Try fuzzy matching
    const { data: fuzzyMatches } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .or(`artist.ilike.%${artist}%, title.ilike.%${artist}%`)
      .limit(3);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      console.log(`✅ Found fuzzy collection match: ${fuzzyMatches[0].artist} - ${fuzzyMatches[0].title}`);
      return fuzzyMatches[0];
    }

    console.log(`❌ No collection match found for: ${artist}${album ? ` - ${album}` : ''}`);
    return null;
  } catch (error) {
    console.error('Collection matching error:', error);
    return null;
  }
}

// Enhanced artwork search across multiple services
async function searchForArtwork(artist: string, album?: string): Promise<string | undefined> {
  console.log(`Searching for artwork: ${artist}${album ? ` - ${album}` : ''}`);
  
  // Try Spotify first
  try {
    const spotifyArtwork = await searchSpotifyArtwork(artist, album);
    if (spotifyArtwork) {
      console.log('Found artwork via Spotify');
      return spotifyArtwork;
    }
  } catch (error) {
    console.warn('Spotify artwork search failed:', error);
  }

  // Try Last.fm as fallback
  try {
    const lastfmArtwork = await searchLastFmArtwork(artist, album);
    if (lastfmArtwork) {
      console.log('Found artwork via Last.fm');
      return lastfmArtwork;
    }
  } catch (error) {
    console.warn('Last.fm artwork search failed:', error);
  }

  console.log('No artwork found across all services');
  return undefined;
}

async function searchSpotifyArtwork(artist: string, album?: string): Promise<string | undefined> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return undefined;
  }

  try {
    // Get access token
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

    // Search for the album
    const query = album ? `artist:"${artist}" album:"${album}"` : `artist:"${artist}"`;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!searchResponse.ok) return undefined;

    const searchData = await searchResponse.json();
    const albums = searchData.albums?.items;
    
    if (albums && albums.length > 0 && albums[0].images && albums[0].images.length > 0) {
      return albums[0].images[0].url;
    }
  } catch (error) {
    console.error('Spotify artwork search error:', error);
  }

  return undefined;
}

async function searchLastFmArtwork(artist: string, album?: string): Promise<string | undefined> {
  if (!process.env.LASTFM_API_KEY) {
    return undefined;
  }

  try {
    const apiKey = process.env.LASTFM_API_KEY;
    
    if (album) {
      // Search for specific album
      const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
      const response = await fetch(url);
      const data: LastFmAlbumResponse = await response.json();
      
      if (data.album && data.album.image) {
        const largeImage = data.album.image.find((img: LastFmImage) => img.size === 'extralarge');
        if (largeImage && largeImage['#text']) {
          return largeImage['#text'];
        }
      }
    }
    
    // Try artist's top albums as fallback
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artist)}&api_key=${apiKey}&format=json&limit=1`;
    const response = await fetch(url);
    const data: LastFmTopAlbumsResponse = await response.json();
    
    if (data.topalbums && data.topalbums.album) {
      const albums = Array.isArray(data.topalbums.album) ? data.topalbums.album : [data.topalbums.album];
      if (albums.length > 0 && albums[0].image) {
        const largeImage = albums[0].image.find((img: LastFmImage) => img.size === 'extralarge');
        if (largeImage && largeImage['#text']) {
          return largeImage['#text'];
        }
      }
    }
  } catch (error) {
    console.error('Last.fm artwork search error:', error);
  }

  return undefined;
}

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

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);

    // Service configuration with fallback order
    const services: ServiceConfig[] = [
      {
        name: 'ACRCloud',
        apiKey: process.env.ACRCLOUD_ACCESS_KEY,
        enabled: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY)
      },
      {
        name: 'AudD',
        apiKey: process.env.AUDD_API_TOKEN,
        enabled: !!process.env.AUDD_API_TOKEN
      }
    ];

    const enabledServices = services.filter(service => service.enabled);
    
    if (enabledServices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No audio recognition services configured. Please add environment variables.'
      }, { status: 500 });
    }

    console.log(`Attempting recognition with ${enabledServices.length} services:`, enabledServices.map(s => s.name));

    // Try each service in order until one succeeds
    for (const service of enabledServices) {
      try {
        console.log(`Trying ${service.name}...`);
        
        let result: RecognitionResult;
        
        switch (service.name) {
          case 'ACRCloud':
            result = await recognizeWithACRCloud(audioFile);
            break;
          case 'AudD':
            result = await recognizeWithAudD(audioFile, service.apiKey!);
            break;
          default:
            continue;
        }

        if (result.success && result.track) {
          console.log(`✅ Success with ${service.name}:`, result.track);
          
          // Check for collection match
          const collectionMatch = await findCollectionMatch(result.track.artist, result.track.album);
          
          if (collectionMatch) {
            result.track.collection_match = collectionMatch;
            result.track.is_guest_vinyl = false;
            console.log(`🎵 Collection match found: ${collectionMatch.artist} - ${collectionMatch.title}`);
            
            // Use collection artwork if recognition doesn't have it
            if (!result.track.image_url && collectionMatch.image_url) {
              result.track.image_url = collectionMatch.image_url;
            }
          } else {
            result.track.is_guest_vinyl = true;
            console.log(`👤 Guest vinyl: ${result.track.artist} - ${result.track.title}`);
          }
          
          // Enhanced artwork fallback search only if no image found
          if (!result.track.image_url) {
            console.log('No artwork from recognition or collection, searching other services...');
            result.track.image_url = await searchForArtwork(result.track.artist, result.track.album);
          }

          // Also enhance candidates with collection matching and artwork
          if (result.candidates) {
            for (const candidate of result.candidates) {
              const candidateMatch = await findCollectionMatch(candidate.artist, candidate.album);
              const enhancedCandidate = candidate as EnhancedRecognitionTrack;
              if (candidateMatch) {
                enhancedCandidate.collection_match = candidateMatch;
                enhancedCandidate.is_guest_vinyl = false;
                if (!candidate.image_url && candidateMatch.image_url) {
                  candidate.image_url = candidateMatch.image_url;
                }
              } else {
                enhancedCandidate.is_guest_vinyl = true;
                if (!candidate.image_url) {
                  candidate.image_url = await searchForArtwork(candidate.artist, candidate.album);
                }
              }
            }
          }

          // Update now playing in database with enhanced info
          try {
            const updateData: NowPlayingUpdate = {
              artist: result.track.artist,
              title: result.track.title,
              album_title: result.track.album,
              recognition_image_url: result.track.image_url,
              album_id: collectionMatch?.id || null,
              started_at: new Date().toISOString(),
              recognition_confidence: result.track.confidence || 0.8,
              service_used: result.track.service || service.name,
              updated_at: new Date().toISOString()
            };

            await supabase
              .from('now_playing')
              .upsert({ id: 1, ...updateData });

            console.log('✅ Now playing updated in database');
          } catch (dbError) {
            console.error('Database update error:', dbError);
            // Don't fail the recognition for this
          }

          console.log(`Found ${result.candidates?.length || 0} additional candidates`);
          return NextResponse.json(result);
        } else {
          console.log(`❌ No match with ${service.name}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error with ${service.name}:`, error);
        // Continue to next service
      }
    }

    // If we get here, all services failed
    return NextResponse.json({
      success: false,
      error: `No matches found with any service (tried: ${enabledServices.map(s => s.name).join(', ')})`
    });

  } catch (error) {
    console.error('Audio recognition error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Enhanced ACRCloud with better artwork extraction
async function recognizeWithACRCloud(audioFile: File): Promise<RecognitionResult> {
  try {
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY!;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY!;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    console.log('ACRCloud: Converting audio file...');
    
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
    
    console.log('ACRCloud: Sending request to', `https://${endpoint}/v1/identify`);
    
    const response = await fetch(`https://${endpoint}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ACRCloud API error:', response.status, errorText);
      throw new Error(`ACRCloud API error: ${response.status} ${response.statusText}`);
    }

    const data: ACRCloudResponse = await response.json();
    console.log('ACRCloud response:', JSON.stringify(data, null, 2));
    
    if (data.status?.code === 0 && data.metadata?.music && data.metadata.music.length > 0) {
      const tracks = data.metadata.music;
      
      // Enhanced artwork extraction with priority order
      const extractImageUrl = (track: ACRCloudTrack): string | undefined => {
        // Try Spotify first (usually highest quality)
        if (track.external_metadata?.spotify?.album?.images && 
            track.external_metadata.spotify.album.images.length > 0) {
          return track.external_metadata.spotify.album.images[0]?.url;
        }
        
        // Try Apple Music
        if (track.external_metadata?.apple_music?.album?.artwork?.url) {
          return track.external_metadata.apple_music.album.artwork.url;
        }
        
        // Try Deezer
        if (track.external_metadata?.deezer?.album?.cover_big) {
          return track.external_metadata.deezer.album.cover_big;
        }
        
        // Try YouTube Music
        if (track.external_metadata?.youtube?.thumbnail) {
          return track.external_metadata.youtube.thumbnail;
        }
        
        return undefined;
      };
      
      const convertTrack = (track: ACRCloudTrack, index: number): RecognitionTrack => {
        const confidence = tracks.length > 1 ? 
          Math.max(0.5, (data.status?.score || 80) / 100 - (index * 0.1)) : 
          (data.status?.score || 80) / 100;
          
        return {
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.album?.name,
          image_url: extractImageUrl(track),
          confidence: confidence,
          service: 'ACRCloud'
        };
      };
      
      const primaryTrack = convertTrack(tracks[0], 0);
      const candidates = tracks.slice(1, 6).map((track: ACRCloudTrack, index: number) => convertTrack(track, index + 1));
      
      console.log(`ACRCloud found primary track: ${primaryTrack.title} by ${primaryTrack.artist}`);
      console.log(`ACRCloud found ${candidates.length} additional candidates`);
      
      return {
        success: true,
        track: primaryTrack,
        candidates: candidates
      };
    }
    
    return { 
      success: false, 
      error: `ACRCloud: ${data.status?.msg || 'No match found'} (code: ${data.status?.code})` 
    };
    
  } catch (error: unknown) {
    console.error('ACRCloud error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `ACRCloud failed: ${message}` };
  }
}

// Enhanced AudD.io service 
async function recognizeWithAudD(audioFile: File, apiKey: string): Promise<RecognitionResult> {
  try {
    console.log('AudD: Preparing request...');
    
    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify,deezer');

    console.log('AudD: Sending request...');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AudD API error:', response.status, errorText);
      throw new Error(`AudD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('AudD response:', data.status);
    
    if (data.status === 'success' && data.result) {
      // Extract artwork from external metadata with priority
      let imageUrl: string | undefined;
      
      if (data.result.spotify?.album?.images?.length > 0) {
        imageUrl = data.result.spotify.album.images[0].url;
      } else if (data.result.apple_music?.artwork?.url) {
        imageUrl = data.result.apple_music.artwork.url;
      } else if (data.result.deezer?.album?.cover_big) {
        imageUrl = data.result.deezer.album.cover_big;
      }
      
      return {
        success: true,
        track: {
          artist: data.result.artist || 'Unknown Artist',
          title: data.result.title || 'Unknown Title',
          album: data.result.album,
          image_url: imageUrl,
          confidence: 0.8,
          service: 'AudD'
        },
        candidates: [] // AudD typically only returns one result
      };
    }
    
    return { success: false, error: `AudD: ${data.error?.error_message || 'No match found'}` };
  } catch (error: unknown) {
    console.error('AudD error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `AudD failed: ${message}` };
  }
}

export async function GET(): Promise<NextResponse> {
  // Check which services are configured
  const services = [
    { 
      name: 'ACRCloud', 
      enabled: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY),
      config: process.env.ACRCLOUD_ACCESS_KEY ? 'Configured' : 'Missing ACRCLOUD_ACCESS_KEY and ACRCLOUD_SECRET_KEY'
    },
    { 
      name: 'AudD', 
      enabled: !!process.env.AUDD_API_TOKEN,
      config: process.env.AUDD_API_TOKEN ? 'Configured' : 'Missing AUDD_API_TOKEN'
    },
    {
      name: 'Spotify (artwork)',
      enabled: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      config: process.env.SPOTIFY_CLIENT_ID ? 'Configured' : 'Missing SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET'
    },
    {
      name: 'Last.fm (artwork)',
      enabled: !!process.env.LASTFM_API_KEY,
      config: process.env.LASTFM_API_KEY ? 'Configured' : 'Missing LASTFM_API_KEY'
    }
  ];

  const enabledServices = services.filter(s => s.enabled);
  const disabledServices = services.filter(s => !s.enabled);

  return NextResponse.json({ 
    message: 'Enhanced Multi-Service Audio Recognition API with Collection Matching',
    enabledServices: enabledServices.map(s => s.name),
    disabledServices: disabledServices.map(s => `${s.name} (${s.config})`),
    features: [
      'Collection matching for owned vs guest vinyl detection',
      'Multiple recognition candidates for correction',
      'Intelligent artwork search across Spotify, Last.fm, and MusicBrainz',
      'Fallback service ordering',
      'Automatic TV display updates',
      'Enhanced error reporting',
      'Album artwork for all candidates'
    ]
  });
}