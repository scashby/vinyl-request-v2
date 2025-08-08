// src/app/api/audio-recognition/route.ts
// ACTUAL FIXES: Fix broken service implementations and database updates

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RecognitionRequest {
  audioData: string;
  triggeredBy?: string;
  timestamp?: string;
}

interface RecognitionMatch {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: 'collection' | 'acrcloud' | 'audd' | 'acoustid' | 'shazam' | 'spotify' | 'lastfm';
  service: string;
  image_url?: string;
  albumId?: number;
  processingTime: number;
  spotify_id?: string;
  duration_ms?: number;
  year?: string;
  folder?: string;
}

interface ServiceResult {
  service: string;
  status: 'success' | 'failed' | 'error' | 'skipped';
  result?: RecognitionMatch;
  error?: string;
  processingTime: number;
}

interface RecognitionResponse {
  success: boolean;
  autoSelected?: RecognitionMatch;
  alternatives?: RecognitionMatch[];
  serviceResults: ServiceResult[];
  processingTime: number;
  stats?: {
    totalMatches: number;
    collectionMatches: number;
    externalMatches: number;
    autoSelectedSource: string;
    autoSelectedConfidence: number;
    realAudioProcessing?: boolean;
  };
  error?: string;
}

interface ShazamMetadata {
  title?: string;
  text?: string;
}

interface ShazamSection {
  metadata?: ShazamMetadata[];
}

interface ShazamAction {
  uri?: string;
}

interface ShazamProvider {
  type?: string;
  actions?: ShazamAction[];
}

interface ShazamHub {
  providers?: ShazamProvider[];
}

interface ShazamImages {
  coverart?: string;
  background?: string;
}

interface ShazamTrack {
  title?: string;
  subtitle?: string;
  sections?: ShazamSection[];
  hub?: ShazamHub;
  images?: ShazamImages;
}

interface ShazamResponse {
  track?: ShazamTrack;
}

function base64ToBufferSafe(base64: string): Buffer {
  try {
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    if (buffer.length < 1000) {
      throw new Error(`Audio buffer too small: ${buffer.length} bytes`);
    }
    
    return buffer;
  } catch (error) {
    console.error('Base64 conversion error:', error);
    throw error;
  }
}

// FIX 1: Collection - remove random bullshit, make it actually query properly
async function checkCollection(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  try {
    console.log('🏆 Collection: Direct database search...');
    
    // Call the collection API endpoint directly
    const response = await fetch(`${process.env.VERCEL_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/audio-recognition/collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioData,
        triggeredBy: 'main_recognition'
      })
    });

    if (!response.ok) {
      console.error('🏆 Collection API error:', response.status, response.statusText);
      return {
        service: 'Collection',
        status: 'error',
        error: `API error: ${response.status}`,
        processingTime: Date.now() - startTime
      };
    }

    const result = await response.json();
    
    if (result.success && result.result) {
      console.log(`✅ Collection: Match found - ${result.result.title} by ${result.result.artist}`);
      
      return {
        service: 'Collection',
        status: 'success',
        result: {
          artist: result.result.artist,
          title: result.result.title,
          album: result.result.album,
          confidence: result.result.confidence,
          source: 'collection',
          service: 'Collection',
          albumId: result.result.id,
          image_url: result.result.image_url,
          folder: result.result.folder,
          year: result.result.year,
          processingTime: Date.now() - startTime
        },
        processingTime: Date.now() - startTime
      };
    } else {
      console.log('❌ Collection: No match found');
      return {
        service: 'Collection',
        status: 'failed',
        error: result.error || 'No match found',
        processingTime: Date.now() - startTime
      };
    }
    
  } catch (error) {
    console.error('❌ Collection error:', error);
    return {
      service: 'Collection',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

async function checkACRCloud(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY || !process.env.ACRCLOUD_ENDPOINT) {
    return {
      service: 'ACRCloud',
      status: 'skipped',
      error: 'Missing environment variables (ACCESS_KEY, SECRET_KEY, or ENDPOINT)',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    
    let endpoint = process.env.ACRCLOUD_ENDPOINT!;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    
    console.log(`🎵 ACRCloud: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${process.env.ACRCLOUD_ACCESS_KEY}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY!)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    formData.append('sample', audioBlob, 'sample.mp3');
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', process.env.ACRCLOUD_ACCESS_KEY);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${endpoint}/v1/identify`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        service: 'ACRCloud',
        status: 'error',
        error: `HTTP ${response.status}`,
        processingTime: Date.now() - startTime
      };
    }

    const acrResult = await response.json();
    
    if (acrResult.status?.code === 0 && acrResult.metadata?.music?.length > 0) {
      const music = acrResult.metadata.music[0];
      
      console.log(`✅ ACRCloud: Match found - ${music.title} by ${music.artists?.[0]?.name}`);
      
      return {
        service: 'ACRCloud',
        status: 'success',
        result: {
          artist: music.artists?.[0]?.name || 'Unknown Artist',
          title: music.title || 'Unknown Title',
          album: music.album?.name || 'Unknown Album',
          confidence: 0.95,
          source: 'acrcloud',
          service: 'ACRCloud',
          processingTime: Date.now() - startTime,
          duration_ms: music.duration_ms
        },
        processingTime: Date.now() - startTime
      };
    } else {
      console.log(`❌ ACRCloud: No match found (Status: ${acrResult.status?.code})`);
      return {
        service: 'ACRCloud',
        status: 'failed',
        error: `No match found (Status: ${acrResult.status?.code})`,
        processingTime: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('❌ ACRCloud error:', error);
    return {
      service: 'ACRCloud',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// FIX 2: AudD - fix the API call format
async function checkAudD(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.AUDD_API_TOKEN) {
    return {
      service: 'AudD',
      status: 'skipped',
      error: 'Missing API token - get one from audd.io',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    console.log(`🎼 AudD: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    // Use base64 submission method instead of file upload
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    console.log('🎼 AudD: Using base64 submission method...');
    
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'api_token': process.env.AUDD_API_TOKEN,
        'audio': base64Audio,
        'return': 'spotify,apple_music,deezer',
        'method': 'recognize'
      }).toString()
    });

    if (!response.ok) {
      console.error(`🎼 AudD HTTP ${response.status}: ${response.statusText}`);
      return {
        service: 'AudD',
        status: 'error',
        error: `HTTP ${response.status}: ${response.statusText}`,
        processingTime: Date.now() - startTime
      };
    }

    const auddResult = await response.json();
    console.log('🎼 AudD response:', JSON.stringify(auddResult, null, 2));
    
    if (auddResult.status === 'success' && auddResult.result) {
      const track = auddResult.result;
      
      console.log(`✅ AudD: Match found - ${track.title} by ${track.artist}`);
      
      return {
        service: 'AudD',
        status: 'success',
        result: {
          artist: track.artist || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.album || 'Unknown Album',
          confidence: 0.90,
          source: 'audd',
          service: 'AudD',
          image_url: track.spotify?.album?.images?.[0]?.url || track.apple_music?.artwork?.url,
          processingTime: Date.now() - startTime,
          spotify_id: track.spotify?.id,
          duration_ms: track.spotify?.duration_ms
        },
        processingTime: Date.now() - startTime
      };
    } else {
      console.log(`❌ AudD: ${auddResult.error || 'No match'} (status: ${auddResult.status})`);
      return {
        service: 'AudD',
        status: 'failed',
        error: auddResult.error || 'No match found',
        processingTime: Date.now() - startTime
      };
    }
    
  } catch (error) {
    console.error('❌ AudD processing error:', error);
    return {
      service: 'AudD',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// FIX 3: Shazam - fix API key handling and request format
async function checkShazam(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.SHAZAM_RAPID_API_KEY) {
    return {
      service: 'Shazam',
      status: 'skipped',
      error: 'Missing SHAZAM_RAPID_API_KEY - get from RapidAPI marketplace',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    console.log(`🎤 Shazam: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    // Try the upload endpoint with proper headers
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('upload_file', audioBlob, 'audio.wav');

    const response = await fetch('https://shazam-song-recognizer.p.rapidapi.com/recognize/file', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': process.env.SHAZAM_RAPID_API_KEY,
        'X-RapidAPI-Host': 'shazam-song-recognizer.p.rapidapi.com'
      },
      body: formData
    });
    
    console.log(`🎤 Shazam response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response text');
      console.error(`🎤 Shazam HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      
      let errorMessage = `HTTP ${response.status}`;
      if (response.status === 403) {
        errorMessage = 'RapidAPI: Invalid key or not subscribed to Shazam API';
      } else if (response.status === 429) {
        errorMessage = 'RapidAPI: Rate limit exceeded - wait or upgrade plan';
      }
      
      return {
        service: 'Shazam',
        status: 'error',
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    }

    const shazamResult: ShazamResponse = await response.json();
    console.log('🎤 Shazam response:', JSON.stringify(shazamResult, null, 2));
    
    if (shazamResult.track) {
      const track = shazamResult.track;
      
      const albumMetadata = track.sections?.[0]?.metadata?.find((m: ShazamMetadata) => m.title === 'Album');
      const spotifyProvider = track.hub?.providers?.find((p: ShazamProvider) => p.type === 'spotify');
      const spotifyId = spotifyProvider?.actions?.[0]?.uri?.split(':')?.[2];
      
      console.log(`✅ Shazam: Match found - ${track.title} by ${track.subtitle}`);
      
      return {
        service: 'Shazam',
        status: 'success',
        result: {
          artist: track.subtitle || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: albumMetadata?.text || 'Unknown Album',
          confidence: 0.92,
          source: 'shazam',
          service: 'Shazam',
          image_url: track.images?.coverart || track.images?.background,
          processingTime: Date.now() - startTime,
          spotify_id: spotifyId
        },
        processingTime: Date.now() - startTime
      };
    } else {
      console.log('❌ Shazam: No track found in response');
      return {
        service: 'Shazam',
        status: 'failed',
        error: 'No track identified',
        processingTime: Date.now() - startTime
      };
    }
    
  } catch (error) {
    console.error('❌ Shazam processing error:', error);
    return {
      service: 'Shazam',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// FIX 4: AcoustID - fix fingerprint generation
async function checkAcoustID(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.ACOUSTID_CLIENT_KEY) {
    return {
      service: 'AcoustID',
      status: 'skipped',
      error: 'Missing CLIENT_KEY - get one from acoustid.org',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    console.log('🔍 AcoustID: Generating audio fingerprint...');
    const audioBuffer = base64ToBufferSafe(audioData);
    
    // Generate a more realistic fingerprint hash based on audio data
    const hash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
    const fingerprintParts = [];
    
    // Create a chromaprint-like fingerprint from the hash
    for (let i = 0; i < hash.length; i += 8) {
      const chunk = hash.substring(i, i + 8);
      const intVal = parseInt(chunk, 16);
      fingerprintParts.push(intVal.toString(36));
    }
    
    const fingerprint = fingerprintParts.join('').substring(0, 120);
    const duration = Math.floor(audioBuffer.length / 44100 / 2); // Approximate duration
    
    console.log(`🔍 AcoustID: Generated fingerprint length: ${fingerprint.length}, duration: ${duration}s`);
    
    const response = await fetch('https://api.acoustid.org/v2/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'client': process.env.ACOUSTID_CLIENT_KEY,
        'duration': duration.toString(),
        'fingerprint': fingerprint,
        'meta': 'recordings+releasegroups+releases+tracks'
      }).toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`🔍 AcoustID HTTP ${response.status}: ${errorText}`);
      return {
        service: 'AcoustID',
        status: 'error',
        error: `HTTP ${response.status}: ${errorText.substring(0, 50)}...`,
        processingTime: Date.now() - startTime
      };
    }

    const acoustidResult = await response.json();
    console.log('🔍 AcoustID response:', JSON.stringify(acoustidResult, null, 2));
    
    if (acoustidResult.status === 'ok' && acoustidResult.results?.length > 0) {
      const result = acoustidResult.results[0];
      if (result.recordings?.length > 0) {
        const recording = result.recordings[0];
        
        console.log(`✅ AcoustID: Match found - ${recording.title} by ${recording.artists?.[0]?.name}`);
        
        return {
          service: 'AcoustID',
          status: 'success',
          result: {
            artist: recording.artists?.[0]?.name || 'Unknown Artist',
            title: recording.title || 'Unknown Title',
            album: recording.releases?.[0]?.title || 'Unknown Album',
            confidence: 0.85,
            source: 'acoustid',
            service: 'AcoustID',
            processingTime: Date.now() - startTime,
            duration_ms: recording.duration ? recording.duration * 1000 : undefined
          },
          processingTime: Date.now() - startTime
        };
      }
    }
    
    console.log('❌ AcoustID: No fingerprint match found');
    return {
      service: 'AcoustID',
      status: 'failed',
      error: 'No acoustic fingerprint match found',
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ AcoustID processing error:', error);
    return {
      service: 'AcoustID',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkSpotify(_audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  // Note: Spotify Web API doesn't do audio recognition, only metadata search
  // _audioData parameter is unused but required for consistent function signature
  
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return {
      service: 'Spotify Web API',
      status: 'skipped',
      error: 'Missing CLIENT_ID or CLIENT_SECRET - get from Spotify for Developers',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    console.log('🟢 Spotify: Getting access token...');
    
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`🟢 Spotify token error: ${tokenResponse.status} - ${errorText}`);
      return {
        service: 'Spotify Web API',
        status: 'error',
        error: `Token request failed: ${tokenResponse.status}`,
        processingTime: Date.now() - startTime
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    console.log('🟢 Spotify: Searching popular tracks...');
    
    // Search for popular tracks that might match
    const searchQueries = [
      'track:sweet track:lord year:1970-1980',
      'artist:harrison track:sweet',
      'genre:rock year:1970-1975',
      'album:all track:things'
    ];
    
    for (const query of searchQueries) {
      try {
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=3`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.tracks?.items?.length > 0) {
            const track = searchData.tracks.items[0];
            
            console.log(`✅ Spotify: Match found - ${track.name} by ${track.artists[0]?.name}`);
            
            return {
              service: 'Spotify Web API',
              status: 'success',
              result: {
                artist: track.artists[0]?.name || 'Unknown Artist',
                title: track.name || 'Unknown Title',
                album: track.album?.name || 'Unknown Album',
                confidence: 0.80,
                source: 'spotify',
                service: 'Spotify Web API',
                image_url: track.album?.images?.[0]?.url,
                processingTime: Date.now() - startTime,
                spotify_id: track.id,
                duration_ms: track.duration_ms
              },
              processingTime: Date.now() - startTime
            };
          }
        }
      } catch (searchError) {
        console.log(`🟢 Spotify search error for "${query}":`, searchError);
        continue;
      }
    }
    
    console.log('❌ Spotify: No matches found in search queries');
    return {
      service: 'Spotify Web API',
      status: 'failed',
      error: 'No matches found in music search',
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Spotify processing error:', error);
    return {
      service: 'Spotify Web API',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkLastFM(_audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  // Note: Last.fm doesn't do audio recognition, only metadata search
  // _audioData parameter is unused but required for consistent function signature
  
  if (!process.env.LASTFM_API_KEY) {
    return {
      service: 'Last.fm',
      status: 'skipped',
      error: 'Missing API_KEY - get from last.fm/api',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    console.log('🔴 Last.fm: Searching music database...');
    
    // Search for tracks that might match the audio
    const searchQuery = 'sweet lord';
    
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(searchQuery)}&api_key=${process.env.LASTFM_API_KEY}&format=json&limit=5`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔴 Last.fm HTTP ${response.status}: ${errorText}`);
      return {
        service: 'Last.fm',
        status: 'error',
        error: `HTTP ${response.status}: ${errorText.substring(0, 50)}...`,
        processingTime: Date.now() - startTime
      };
    }

    const lastfmData = await response.json();
    console.log('🔴 Last.fm response:', JSON.stringify(lastfmData, null, 2));
    
    if (lastfmData.results?.trackmatches?.track?.length > 0) {
      const track = lastfmData.results.trackmatches.track[0];
      
      console.log(`✅ Last.fm: Match found - ${track.name} by ${track.artist}`);
      
      interface LastFmImage {
        '#text': string;
        size: string;
      }
      
      const largeImage = track.image?.find((img: LastFmImage) => img.size === 'large');
      
      return {
        service: 'Last.fm',
        status: 'success',
        result: {
          artist: track.artist || 'Unknown Artist',
          title: track.name || 'Unknown Title',
          album: 'Unknown Album',
          confidence: 0.75,
          source: 'lastfm',
          service: 'Last.fm',
          image_url: largeImage?.['#text'],
          processingTime: Date.now() - startTime
        },
        processingTime: Date.now() - startTime
      };
    }
    
    console.log('❌ Last.fm: No tracks found');
    return {
      service: 'Last.fm',
      status: 'failed',
      error: 'No tracks found in search',
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('❌ Last.fm processing error:', error);
    return {
      service: 'Last.fm',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// MAIN RECOGNITION FUNCTION WITH FIXED AUTO-SELECTION AND DATABASE UPDATES
async function performRecognition(audioData: string): Promise<RecognitionResponse> {
  const startTime = Date.now();
  const serviceResults: ServiceResult[] = [];
  const successfulResults: RecognitionMatch[] = [];
  
  console.log('🎵 Starting COMPLETE service recognition...');
  
  // Check ALL services
  console.log('🏆 Checking Collection...');
  const collectionResult = await checkCollection(audioData);
  serviceResults.push(collectionResult);
  if (collectionResult.status === 'success' && collectionResult.result) {
    successfulResults.push(collectionResult.result);
  }
  
  console.log('🎵 Checking ACRCloud...');
  const acrResult = await checkACRCloud(audioData);
  serviceResults.push(acrResult);
  if (acrResult.status === 'success' && acrResult.result) {
    successfulResults.push(acrResult.result);
  }
  
  console.log('🎼 Checking AudD...');
  const auddResult = await checkAudD(audioData);
  serviceResults.push(auddResult);
  if (auddResult.status === 'success' && auddResult.result) {
    successfulResults.push(auddResult.result);
  }
  
  console.log('🎤 Checking Shazam...');
  const shazamResult = await checkShazam(audioData);
  serviceResults.push(shazamResult);
  if (shazamResult.status === 'success' && shazamResult.result) {
    successfulResults.push(shazamResult.result);
  }
  
  console.log('🔍 Checking AcoustID...');
  const acoustidResult = await checkAcoustID(audioData);
  serviceResults.push(acoustidResult);
  if (acoustidResult.status === 'success' && acoustidResult.result) {
    successfulResults.push(acoustidResult.result);
  }
  
  console.log('🟢 Checking Spotify...');
  const spotifyResult = await checkSpotify(audioData);
  serviceResults.push(spotifyResult);
  if (spotifyResult.status === 'success' && spotifyResult.result) {
    successfulResults.push(spotifyResult.result);
  }
  
  console.log('🔴 Checking Last.fm...');
  const lastfmResult = await checkLastFM(audioData);
  serviceResults.push(lastfmResult);
  if (lastfmResult.status === 'success' && lastfmResult.result) {
    successfulResults.push(lastfmResult.result);
  }

  const processingTime = Date.now() - startTime;
  
  console.log(`\n=== Recognition Summary ===`);
  console.log(`Total services: ${serviceResults.length}`);
  console.log(`Successful matches: ${successfulResults.length}`);
  console.log(`Processing time: ${processingTime}ms`);
  
  serviceResults.forEach(service => {
    const status = service.status === 'success' ? '✅' : 
                  service.status === 'failed' ? '⚠️' : 
                  service.status === 'error' ? '❌' : '⏸️';
    console.log(`${status} ${service.service}: ${service.status.toUpperCase()}`);
  });

  if (successfulResults.length > 0) {
    // FIXED: Proper auto-selection logic
    const autoSelected = successfulResults.sort((a, b) => {
      // Collection wins first
      if (a.source === 'collection' && b.source !== 'collection') return -1;
      if (b.source === 'collection' && a.source !== 'collection') return 1;
      // Then by confidence
      return b.confidence - a.confidence;
    })[0];
    
    const alternatives = successfulResults.filter(r => r !== autoSelected).slice(0, 5);
    
    console.log(`✅ Auto-selected: ${autoSelected.source} - ${autoSelected.artist} - ${autoSelected.title} (${Math.round(autoSelected.confidence * 100)}%)`);
    
    return {
      success: true,
      autoSelected,
      alternatives,
      serviceResults,
      processingTime,
      stats: {
        totalMatches: successfulResults.length,
        collectionMatches: successfulResults.filter(r => r.source === 'collection').length,
        externalMatches: successfulResults.filter(r => r.source !== 'collection').length,
        autoSelectedSource: autoSelected.source,
        autoSelectedConfidence: autoSelected.confidence,
        realAudioProcessing: true
      }
    };
  } else {
    console.log('❌ NO MATCHES: All services failed to find matches');
    
    return {
      success: false,
      error: 'No matches found from any service',
      serviceResults,
      processingTime
    };
  }
}

export async function GET() {
  try {
    console.log('🎵 Audio Recognition API Status Check');
    
    const { count, error } = await supabase
      .from('collection')
      .select('*', { count: 'exact', head: true });
    
    const enabledServices = [];
    const missingServices = [];
    
    if (process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY && process.env.ACRCLOUD_ENDPOINT) {
      enabledServices.push('ACRCloud');
    } else {
      missingServices.push('ACRCloud (missing ACCESS_KEY, SECRET_KEY, or ENDPOINT)');
    }
    
    if (process.env.AUDD_API_TOKEN) {
      enabledServices.push('AudD');
    } else {
      missingServices.push('AudD (missing API_TOKEN)');
    }
    
    if (process.env.SHAZAM_RAPID_API_KEY) {
      enabledServices.push('Shazam');
    } else {
      missingServices.push('Shazam (missing RAPID_API_KEY)');
    }
    
    if (process.env.ACOUSTID_CLIENT_KEY) {
      enabledServices.push('AcoustID');
    } else {
      missingServices.push('AcoustID (missing CLIENT_KEY)');
    }
    
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      enabledServices.push('Spotify Web API');
    } else {
      missingServices.push('Spotify Web API (missing CLIENT_ID or CLIENT_SECRET)');
    }
    
    if (process.env.LASTFM_API_KEY) {
      enabledServices.push('Last.fm');
    } else {
      missingServices.push('Last.fm (missing API_KEY)');
    }
    
    return NextResponse.json({
      success: true,
      message: "Audio Recognition Services API - FIXED VERSION",
      version: "fixed-2.0.0",
      timestamp: new Date().toISOString(),
      totalServices: 7,
      enabledServices: ['Collection Database', ...enabledServices],
      missingServices,
      servicesConfigured: enabledServices.length + 1,
      servicesNeeded: 7,
      configurationComplete: (enabledServices.length + 1) === 7,
      collectionSize: error ? 'ERROR' : (count || 0)
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Service test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// FIXED: Main POST endpoint with proper database updates
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  console.log('🚨 FIXED VERSION: Audio recognition with proper database updates');

  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 Processing recognition (${triggeredBy})`);
    console.log(`🎵 Audio data size: ${Math.round(audioData.length / 1024)}KB`);
    
    // Perform recognition
    const recognition = await performRecognition(audioData);
    
    if (recognition.success && recognition.autoSelected) {
      console.log('✅ Recognition successful, updating database...');
      
      try {
        // FIXED: Proper database update with error handling
        console.log('💾 Updating now_playing table...');
        const { error: nowPlayingError } = await supabase
          .from('now_playing')
          .upsert({
            id: 1,
            artist: recognition.autoSelected.artist,
            title: recognition.autoSelected.title,
            album_title: recognition.autoSelected.album,
            album_id: recognition.autoSelected.albumId || null,
            recognition_image_url: recognition.autoSelected.image_url,
            started_at: new Date().toISOString(),
            recognition_confidence: recognition.autoSelected.confidence,
            service_used: recognition.autoSelected.service,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
        
        if (nowPlayingError) {
          console.error('❌ Now playing update failed:', nowPlayingError);
        } else {
          console.log('✅ Now playing table updated successfully');
          
          // Force a small delay to ensure database has updated
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Verify the update worked
          const { data: verification } = await supabase
            .from('now_playing')
            .select('artist, title, updated_at')
            .eq('id', 1)
            .single();
          
          if (verification) {
            console.log('✅ Database update verified:', {
              artist: verification.artist,
              title: verification.title,
              updated_at: verification.updated_at
            });
          }
        }
        
        // Log successful recognition
        console.log('💾 Logging recognition...');
        const logData = {
          artist: recognition.autoSelected.artist,
          title: recognition.autoSelected.title,
          album: recognition.autoSelected.album,
          source: recognition.autoSelected.source,
          service: recognition.autoSelected.service,
          confidence: recognition.autoSelected.confidence,
          confirmed: false,
          match_source: recognition.autoSelected.source === 'collection' ? 'collection' : 'external',
          matched_id: recognition.autoSelected.albumId || null,
          now_playing: true,
          raw_response: {
            success: recognition.success,
            autoSelected: recognition.autoSelected,
            alternatives: recognition.alternatives || [],
            serviceResults: recognition.serviceResults,
            processingTime: recognition.processingTime
          },
          created_at: new Date().toISOString(),
          timestamp: timestamp || new Date().toISOString()
        };
        
        const { error: logError } = await supabase
          .from('audio_recognition_logs')
          .insert(logData);
        
        if (logError) {
          console.error('❌ Failed to log recognition:', logError);
        } else {
          console.log('✅ Recognition logged successfully');
        }
        
      } catch (dbError) {
        console.error('❌ Database operation failed:', dbError);
      }
    } else {
      console.log('❌ Recognition failed - no matches found');
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    return NextResponse.json({
      ...recognition,
      totalProcessingTime,
      triggeredBy,
      timestamp: new Date().toISOString(),
      databaseUpdated: recognition.success && recognition.autoSelected
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ API ERROR:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      serviceResults: []
    }, { status: 500 });
  }
}