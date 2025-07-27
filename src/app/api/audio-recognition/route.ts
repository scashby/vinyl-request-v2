// src/app/api/audio-recognition/route.ts - Real Service Integration

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';
import crypto from 'crypto';

export async function GET() {
  return NextResponse.json({
    message: 'Audio Recognition API is available',
    services: ['ACRCloud', 'AudD', 'AcoustID'],
    status: 'active',
    version: '2.0.0',
    endpoints: {
      'POST /api/audio-recognition': 'Process audio for recognition',
      'GET /api/audio-recognition/logs': 'Get recognition logs',
      'GET /api/audio-recognition/service-test': 'Test recognition services'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const startTime = Date.now();
    
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Failed to parse request body:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON in request body' 
        },
        { status: 400 }
      );
    }
    
    console.log('🎵 Audio recognition request received:', {
      hasAudioData: !!body.audioData,
      audioDataType: typeof body.audioData,
      triggeredBy: body.triggeredBy,
      timestamp: body.timestamp,
      audioDataLength: body.audioData ? body.audioData.length : 0
    });

    // Validate required fields
    if (!body.audioData) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing audioData field. Please provide base64 encoded audio data.' 
        },
        { status: 400 }
      );
    }

    // Handle different audio data formats
    let audioBuffer: Buffer;
    try {
      let base64Data = body.audioData;
      
      // Handle data URL format
      if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
      }
      
      // Handle array format (from frontend Float32Array conversion)
      if (Array.isArray(body.audioData)) {
        // Convert Float32Array back to audio buffer
        const float32Array = new Float32Array(body.audioData);
        const buffer = Buffer.alloc(float32Array.length * 4);
        for (let i = 0; i < float32Array.length; i++) {
          buffer.writeFloatLE(float32Array[i], i * 4);
        }
        audioBuffer = buffer;
      } else if (typeof base64Data === 'string') {
        // Handle base64 string
        audioBuffer = Buffer.from(base64Data, 'base64');
      } else {
        throw new Error('Unsupported audio data format');
      }
      
      if (audioBuffer.length === 0) {
        throw new Error('Empty audio buffer');
      }
      
      console.log('✅ Audio buffer processed:', {
        size: audioBuffer.length,
        sizeKB: Math.round(audioBuffer.length / 1024),
        format: Array.isArray(body.audioData) ? 'Float32Array' : 'base64'
      });
    } catch (error) {
      console.error('❌ Audio data processing error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid audio data: ${error instanceof Error ? error.message : 'Unknown format'}` 
        },
        { status: 400 }
      );
    }

    // Process audio with real recognition services
    const recognitionResult = await processAudioWithRealServices(audioBuffer, {
      triggeredBy: body.triggeredBy || 'manual',
      timestamp: body.timestamp || new Date().toISOString()
    });
    
    const processingTime = Date.now() - startTime;
    
    // Log the recognition attempt
    try {
      const logEntry = {
        artist: recognitionResult.success ? recognitionResult.artist : null,
        title: recognitionResult.success ? recognitionResult.title : null,
        album: recognitionResult.success ? recognitionResult.album : null,
        source: body.triggeredBy || 'manual',
        service: recognitionResult.service || 'multi-service',
        confidence: recognitionResult.confidence || 0,
        confirmed: false,
        raw_response: recognitionResult,
        created_at: new Date().toISOString(),
        timestamp: body.timestamp || new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('audio_recognition_logs')
        .insert(logEntry);

      if (logError) {
        console.error('⚠️ Failed to log recognition:', logError);
      } else {
        console.log('📝 Recognition logged successfully');
      }
    } catch (logError) {
      console.error('⚠️ Logging error:', logError);
    }

    // Update now playing if recognition was successful
    if (recognitionResult.success) {
      try {
        const { error: nowPlayingError } = await supabase
          .from('now_playing')
          .upsert({
            id: 1,
            artist: recognitionResult.artist,
            title: recognitionResult.title,
            album_title: recognitionResult.album,
            started_at: new Date().toISOString(),
            recognition_confidence: recognitionResult.confidence,
            service_used: recognitionResult.service,
            updated_at: new Date().toISOString(),
            next_recognition_in: 30
          });

        if (nowPlayingError) {
          console.error('⚠️ Failed to update now playing:', nowPlayingError);
        } else {
          console.log('🎯 Now playing updated successfully');
        }
      } catch (nowPlayingError) {
        console.error('⚠️ Now playing update error:', nowPlayingError);
      }
    }

    // Return response
    const response = {
      success: recognitionResult.success,
      result: recognitionResult.success ? {
        artist: recognitionResult.artist,
        title: recognitionResult.title,
        album: recognitionResult.album,
        confidence: recognitionResult.confidence,
        service: recognitionResult.service
      } : null,
      error: recognitionResult.success ? null : recognitionResult.error,
      processingTime
    };

    console.log('🎵 Recognition response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('🚨 Audio recognition API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        processingTime: Date.now()
      },
      { status: 500 }
    );
  }
}

// Real audio recognition processing function using actual services
async function processAudioWithRealServices(
  audioBuffer: Buffer, 
  context: { triggeredBy: string; timestamp: string }
) {
  const startTime = Date.now();
  
  console.log('🔄 Processing audio with real recognition services...', {
    bufferSize: audioBuffer.length,
    triggeredBy: context.triggeredBy
  });
  
  try {
    // Try ACRCloud first (usually most accurate for music)
    console.log('🎯 Trying ACRCloud...');
    const acrResult = await tryACRCloud(audioBuffer);
    if (acrResult.success) {
      console.log('✅ ACRCloud recognition successful:', acrResult);
      return {
        ...acrResult,
        processingTime: Date.now() - startTime
      };
    }
    
    // Try AudD as fallback
    console.log('🎯 Trying AudD...');
    const auddResult = await tryAudD(audioBuffer);
    if (auddResult.success) {
      console.log('✅ AudD recognition successful:', auddResult);
      return {
        ...auddResult,
        processingTime: Date.now() - startTime
      };
    }
    
    // Try AcoustID as last resort
    console.log('🎯 Trying AcoustID...');
    const acoustidResult = await tryAcoustID(audioBuffer);
    if (acoustidResult.success) {
      console.log('✅ AcoustID recognition successful:', acoustidResult);
      return {
        ...acoustidResult,
        processingTime: Date.now() - startTime
      };
    }
    
    console.log('❌ All recognition services failed');
    return {
      success: false,
      error: 'No match found in any recognition service',
      service: 'multi-service',
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('💥 Recognition processing error:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Recognition processing failed',
      service: 'multi-service',
      processingTime: Date.now() - startTime
    };
  }
}

// ACRCloud integration
async function tryACRCloud(audioBuffer: Buffer) {
  try {
    const host = process.env.ACRCLOUD_ENDPOINT || 'identify-eu-west-1.acrcloud.com';
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    
    if (!accessKey || !secretKey) {
      console.log('⚠️ ACRCloud credentials not configured');
      return { success: false, error: 'ACRCloud credentials not configured' };
    }
    
    // Create ACRCloud signature
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;
    const signature = crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
    
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer]), 'audio.wav');
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`ACRCloud HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('ACRCloud response:', data);
    
    if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
      const track = data.metadata.music[0];
      return {
        success: true,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        title: track.title || 'Unknown Title',
        album: track.album?.name || 'Unknown Album',
        confidence: (track.score || 0) / 100,
        service: 'ACRCloud'
      };
    }
    
    return {
      success: false,
      error: data.status?.msg || 'No match found',
      service: 'ACRCloud'
    };
    
  } catch (error) {
    console.error('ACRCloud error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ACRCloud service error',
      service: 'ACRCloud'
    };
  }
}

// AudD integration
async function tryAudD(audioBuffer: Buffer) {
  try {
    const apiToken = process.env.AUDD_API_TOKEN;
    
    if (!apiToken) {
      console.log('⚠️ AudD API token not configured');
      return { success: false, error: 'AudD API token not configured' };
    }
    
    const formData = new FormData();
    formData.append('api_token', apiToken);
    formData.append('audio', new Blob([audioBuffer]), 'audio.wav');
    formData.append('return', 'apple_music,spotify');
    
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`AudD HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('AudD response:', data);
    
    if (data.status === 'success' && data.result) {
      return {
        success: true,
        artist: data.result.artist || 'Unknown Artist',
        title: data.result.title || 'Unknown Title',
        album: data.result.album || 'Unknown Album',
        confidence: 0.8, // AudD doesn't provide confidence scores
        service: 'AudD'
      };
    }
    
    return {
      success: false,
      error: data.error?.error_message || 'No match found',
      service: 'AudD'
    };
    
  } catch (error) {
    console.error('AudD error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AudD service error',
      service: 'AudD'
    };
  }
}

// AcoustID integration (requires audio fingerprinting)
async function tryAcoustID(_audioBuffer: Buffer) {
  try {
    const clientKey = process.env.ACOUSTID_CLIENT_KEY;
    
    if (!clientKey) {
      console.log('⚠️ AcoustID client key not configured');
      return { success: false, error: 'AcoustID client key not configured' };
    }
    
    // Note: AcoustID requires audio fingerprinting which typically needs 
    // the chromaprint library. For now, we'll return a placeholder.
    // In a production environment, you'd need to:
    // 1. Install chromaprint/fpcalc
    // 2. Generate fingerprint from audio buffer
    // 3. Send fingerprint to AcoustID
    
    console.log('⚠️ AcoustID requires audio fingerprinting - not implemented in this version');
    console.log(`Audio buffer size: ${_audioBuffer.length} bytes (available for future fingerprinting)`);
    
    return {
      success: false,
      error: 'AcoustID fingerprinting not implemented - requires chromaprint library',
      service: 'AcoustID'
    };
    
  } catch (error) {
    console.error('AcoustID error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'AcoustID service error',
      service: 'AcoustID'
    };
  }
}