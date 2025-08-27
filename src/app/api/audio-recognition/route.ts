// src/app/api/audio-recognition/route.ts - FIXED ENDPOINT
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

    // For other audio types, try to process directly
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return await processWithShazam(base64Audio, audioFile.size, startTime);

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
  console.log('🎵 Calling Shazam Song Recognizer API with RAW PCM data...');

  // FIXED: Use correct API endpoint from RapidAPI subscription
  const apiUrl = 'https://shazam-song-recognizer.p.rapidapi.com/recognize';
  const headers = {
    'content-type': 'text/plain',
    'x-rapidapi-key': process.env.SHAZAM_RAPID_API_KEY,
    'x-rapidapi-host': 'shazam-song-recognizer.p.rapidapi.com'
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
      service: 'shazam-song-recognizer',
      confidence: 0,
      confirmed: false,
      raw_response: shazamData,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      error: 'No track identified by Shazam Song Recognizer',
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

  // Log successful recognition
  await supabase.from('audio_recognition_logs').insert({
    artist,
    title,
    album: null, // Shazam doesn't reliably provide album info
    source: 'microphone',
    service: 'shazam-song-recognizer',
    confidence: shazamData.matches?.length > 0 ? 0.9 : 0.7,
    confirmed: true,
    raw_response: shazamData,
    created_at: new Date().toISOString()
  });

  // Update now_playing table
  try {
    // Clear existing entries
    await supabase.from('now_playing').delete().neq('id', 0);

    // Insert new entry
    await supabase.from('now_playing').insert({
      artist,
      title,
      album_title: null,
      album_id: null,
      started_at: new Date().toISOString(),
      recognition_confidence: shazamData.matches?.length > 0 ? 0.9 : 0.7,
      service_used: 'shazam-song-recognizer',
      recognition_image_url: imageUrl,
      next_recognition_in: 180, // 3 minutes default
      created_at: new Date().toISOString()
    });

    console.log('✅ Updated now_playing table');
  } catch (dbError) {
    console.error('⚠️ Database update failed:', dbError);
  }

  const processingTime = Date.now() - startTime;
  console.log(`✅ Recognition complete in ${processingTime}ms: ${artist} - ${title}`);

  return NextResponse.json({
    success: true,
    track: {
      artist,
      title,
      album: null,
      image_url: imageUrl,
      confidence: shazamData.matches?.length > 0 ? 0.9 : 0.7,
      service: 'shazam-song-recognizer',
      shazam_key: track.key
    },
    // ADDED: Include full Shazam response for timing analysis
    rawResponse: shazamData,
    debugInfo: {
      processingTime,
      audioFileSize: originalSize,
      base64Length: base64Audio.length,
      matchesCount: shazamData.matches?.length || 0,
      // ADDED: Extract timing data for easier access
      timingData: {
        offset: shazamData.matches?.[0]?.offset || null,
        hasMatches: shazamData.matches?.length > 0,
        sections: shazamData.track?.sections?.map(s => s.type) || []
      }
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