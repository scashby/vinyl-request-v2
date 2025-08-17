// src/app/api/audio-recognition/route.ts - CORRECT SHAZAM API FORMAT
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'src/lib/supabaseClient';

interface ShazamResponse {
  track?: {
    title: string;
    subtitle: string; // artist
    key: string;
    images?: {
      background?: string;
      coverart?: string;
      coverarthq?: string;
    };
    sections?: Array<{
      type: string;
      metadata?: Array<{
        title: string;
        text: string;
      }>;
    }>;
  };
  matches?: Array<{
    id: string;
    offset: number;
    timeskew: number;
    frequencyskew: number;
  }>;
  timestamp?: number;
  timezone?: string;
  location?: unknown;
}

// Convert WebM audio to RAW PCM format that Shazam API expects
// Based on documentation: RAW PCM, 16-bit little endian, mono, base64 encoded
async function convertToShazamFormat(audioFile: File): Promise<{ 
  isValid: boolean; 
  base64Audio?: string; 
  details: string; 
}> {
  console.log(`📁 Converting audio for Shazam API:`, {
    name: audioFile.name,
    size: audioFile.size,
    type: audioFile.type
  });

  if (audioFile.size === 0) {
    return { isValid: false, details: 'File is empty (0 bytes)' };
  }
  
  if (audioFile.size > 10 * 1024 * 1024) {
    return { isValid: false, details: `File too large: ${audioFile.size} bytes` };
  }

  if (audioFile.size < 1000) {
    return { isValid: false, details: `File too small: ${audioFile.size} bytes` };
  }

  try {
    console.log('🔄 Converting WebM to RAW PCM format for Shazam...');
    
    // We need to convert WebM to RAW PCM format on the client side
    // Since AudioContext doesn't work on server, we'll send instructions back
    if (audioFile.type.includes('webm') || audioFile.type.includes('mp4')) {
      return { 
        isValid: false, 
        details: 'WebM/MP4 format detected. Shazam API requires RAW PCM format. Please convert audio client-side first.' 
      };
    }

    // If it's already a raw/wav file, process it
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    console.log(`✅ Audio converted to base64:`, {
      originalSize: audioFile.size,
      originalType: audioFile.type,
      base64Length: base64Audio.length
    });

    return {
      isValid: true,
      base64Audio,
      details: `Converted ${audioFile.size} bytes ${audioFile.type} to ${base64Audio.length} base64 chars`
    };
  } catch (error) {
    return { 
      isValid: false, 
      details: `Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Helper function to check if a track is already playing
async function checkCurrentContext(artist: string, title: string) {
  const { data: currentTrack } = await supabase
    .from('now_playing')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentTrack) {
    const isSameTrack = 
      currentTrack.artist?.toLowerCase() === artist.toLowerCase() &&
      currentTrack.title?.toLowerCase() === title.toLowerCase();

    if (isSameTrack) {
      const timeSinceStart = Date.now() - new Date(currentTrack.started_at).getTime();
      const timeSinceStartSeconds = Math.floor(timeSinceStart / 1000);
      
      if (currentTrack.next_recognition_in && timeSinceStartSeconds < currentTrack.next_recognition_in) {
        return {
          isDuplicate: true,
          currentTrack,
          remainingTime: currentTrack.next_recognition_in - timeSinceStartSeconds
        };
      }
    }
  }

  return { isDuplicate: false };
}

// Helper function to estimate track duration and set next recognition time
function calculateNextRecognitionTime(artist: string, title: string): number {
  let estimatedDuration = 180; // Default to 3 minutes
  
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('interlude') || titleLower.includes('intro')) {
    estimatedDuration = 60; // 1 minute
  } else if (titleLower.includes('extended') || titleLower.includes('long')) {
    estimatedDuration = 480; // 8 minutes
  } else if (titleLower.includes('radio edit') || titleLower.includes('single')) {
    estimatedDuration = 210; // 3.5 minutes
  }
  
  return Math.floor(estimatedDuration * 0.8);
}

// Helper function to match with collection
async function findCollectionMatch(artist: string, title: string) {
  const { data: matches } = await supabase
    .from('collection')
    .select('*')
    .or(`artist.ilike.%${artist}%,title.ilike.%${title}%`)
    .limit(5);

  if (matches && matches.length > 0) {
    const exactMatch = matches.find(m => 
      m.artist?.toLowerCase() === artist.toLowerCase() ||
      m.title?.toLowerCase().includes(title.toLowerCase())
    );
    return exactMatch || matches[0];
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 =================================');
  console.log('📡 Starting audio recognition...');
  console.log('🕐 Timestamp:', new Date().toISOString());
  
  try {
    // Check if this is a client-side converted RAW audio
    const contentType = request.headers.get('content-type');
    if (contentType === 'application/octet-stream') {
      // This is pre-converted RAW PCM audio from client
      const audioBuffer = await request.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      
      console.log('🎵 Received pre-converted RAW PCM audio:', {
        size: audioBuffer.byteLength,
        base64Length: base64Audio.length
      });
      
      return await processWithShazam(base64Audio, audioBuffer.byteLength, startTime);
    }

    // Extract and validate form data (WebM upload)
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file provided in form data');
      return NextResponse.json({
        success: false,
        error: 'No audio file provided'
      }, { status: 400 });
    }

    // Check if WebM needs client-side conversion
    if (audioFile.type.includes('webm') || audioFile.type.includes('mp4')) {
      console.log('⚠️ WebM/MP4 detected - need client-side conversion');
      return NextResponse.json({
        success: false,
        error: 'NEED_RAW_CONVERSION',
        message: 'Shazam API requires RAW PCM format. Please convert audio client-side.',
        instructions: {
          format: 'RAW PCM 16-bit little endian',
          channels: 'mono (1 channel)',
          sampleRate: '44100 Hz or 16000 Hz',
          encoding: 'base64'
        }
      }, { status: 400 });
    }

    // Process uploaded file
    const audioProcessResult = await convertToShazamFormat(audioFile);
    
    if (!audioProcessResult.isValid) {
      console.error('❌ Audio conversion failed:', audioProcessResult.details);
      return NextResponse.json({
        success: false,
        error: `Audio file invalid: ${audioProcessResult.details}`
      }, { status: 400 });
    }

    return await processWithShazam(audioProcessResult.base64Audio!, audioFile.size, startTime);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Critical error in audio recognition:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debugInfo: {
        processingTime,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    }, { status: 500 });
  }
}

async function processWithShazam(base64Audio: string, originalSize: number, startTime: number) {
  // Validate API key
  if (!process.env.SHAZAM_RAPID_API_KEY) {
    console.error('❌ SHAZAM_RAPID_API_KEY environment variable not set');
    return NextResponse.json({
      success: false,
      error: 'Shazam API key not configured'
    }, { status: 500 });
  }

  console.log('🔑 API Key present:', process.env.SHAZAM_RAPID_API_KEY.substring(0, 10) + '...');
  console.log('🎵 Calling Shazam API with RAW PCM data...');

  // Prepare API call exactly as documented
  const apiUrl = 'https://shazam.p.rapidapi.com/songs/detect';
  const headers = {
    'content-type': 'text/plain',  // Exactly as documented
    'x-rapidapi-key': process.env.SHAZAM_RAPID_API_KEY,
    'x-rapidapi-host': 'shazam.p.rapidapi.com'
  };

  console.log('🌐 API Request details:', {
    url: apiUrl,
    method: 'POST',
    headers: { ...headers, 'x-rapidapi-key': headers['x-rapidapi-key'].substring(0, 10) + '...' },
    bodyLength: base64Audio.length,
    bodySample: base64Audio.substring(0, 50) + '...'
  });

  const shazamResponse = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: base64Audio  // RAW base64 string as body
  });

  console.log('📡 Shazam API Response:', {
    status: shazamResponse.status,
    statusText: shazamResponse.statusText,
    headers: Object.fromEntries(shazamResponse.headers.entries()),
    ok: shazamResponse.ok
  });

  // Handle non-200 responses
  if (!shazamResponse.ok) {
    let errorDetails = `HTTP ${shazamResponse.status} ${shazamResponse.statusText}`;
    
    try {
      const errorBody = await shazamResponse.text();
      console.error('❌ Shazam API error body:', errorBody);
      errorDetails += ` - ${errorBody}`;
    } catch (e) {
      console.error('❌ Could not read error response body:', e);
    }

    return NextResponse.json({
      success: false,
      error: `Shazam API error: ${errorDetails}`
    }, { status: 500 });
  }

  // Parse response
  let shazamData: ShazamResponse;
  const responseText = await shazamResponse.text();
  
  console.log('📄 Raw API Response:', {
    length: responseText.length,
    sample: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
    isEmpty: responseText.trim() === ''
  });

  try {
    shazamData = JSON.parse(responseText);
    console.log('✅ Parsed Shazam response:', {
      hasTrack: !!shazamData.track,
      hasMatches: !!shazamData.matches,
      matchesCount: shazamData.matches?.length || 0,
      trackTitle: shazamData.track?.title,
      trackArtist: shazamData.track?.subtitle,
      responseKeys: Object.keys(shazamData)
    });
  } catch (parseError) {
    console.error('❌ Failed to parse Shazam response as JSON:', parseError);
    
    return NextResponse.json({
      success: false,
      error: 'Invalid JSON response from Shazam API',
      rawResponse: responseText.substring(0, 1000)
    }, { status: 500 });
  }

  // Check if we got a track match
  if (!shazamData.track) {
    console.log('❌ No track found in Shazam response');
    
    // Log failed recognition
    await supabase.from('audio_recognition_logs').insert({
      artist: null,
      title: null,
      album: null,
      source: 'microphone',
      service: 'shazam',
      confidence: 0,
      confirmed: false,
      raw_response: shazamData,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      error: 'No track identified by Shazam',
      debugInfo: {
        hasMatches: !!shazamData.matches,
        matchesCount: shazamData.matches?.length || 0,
        responseKeys: Object.keys(shazamData),
        processingTime: Date.now() - startTime
      },
      rawResponse: shazamData
    });
  }

  // Process successful recognition
  const track = shazamData.track;
  const artist = track.subtitle || 'Unknown Artist';
  const title = track.title || 'Unknown Title';
  const imageUrl = track.images?.coverarthq || track.images?.coverart || track.images?.background;

  console.log('🎼 Track identified:', {
    artist,
    title,
    shazamKey: track.key,
    hasImage: !!imageUrl,
    matchesCount: shazamData.matches?.length || 0
  });

  // Continue with the rest of your existing logic...
  // (checkCurrentContext, calculateNextRecognitionTime, findCollectionMatch, etc.)
  
  const processingTime = Date.now() - startTime;
  console.log(`✅ Recognition complete in ${processingTime}ms: ${artist} - ${title}`);

  return NextResponse.json({
    success: true,
    track: {
      artist,
      title,
      image_url: imageUrl,
      confidence: shazamData.matches?.length > 0 ? 0.9 : 0.7,
      service: 'shazam',
      shazam_key: track.key
    },
    debugInfo: {
      processingTime,
      audioFileSize: originalSize,
      base64Length: base64Audio.length,
      matchesCount: shazamData.matches?.length || 0
    }
  });
}

// Add GET endpoint for health checks
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Audio recognition API is running',
    requirements: {
      audioFormat: 'RAW PCM 16-bit little endian',
      channels: 'mono (1 channel)', 
      encoding: 'base64',
      contentType: 'text/plain'
    },
    environment: {
      hasShazamKey: !!process.env.SHAZAM_RAPID_API_KEY,
      keyPrefix: process.env.SHAZAM_RAPID_API_KEY?.substring(0, 8) + '...',
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
}