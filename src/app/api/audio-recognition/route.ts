// src/app/api/audio-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface RecognitionResult {
  success: boolean;
  track?: {
    artist: string;
    title: string;
    album?: string;
    confidence?: number;
    service?: string;
  };
  error?: string;
}

interface ServiceConfig {
  name: string;
  apiKey: string | undefined;
  enabled: boolean;
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

    // Service configuration with fallback order
    const services: ServiceConfig[] = [
      {
        name: 'ACRCloud',
        apiKey: process.env.ACRCLOUD_ACCESS_KEY,
        enabled: !!process.env.ACRCLOUD_ACCESS_KEY
      },
      {
        name: 'AudD',
        apiKey: process.env.AUDD_API_TOKEN,
        enabled: !!process.env.AUDD_API_TOKEN
      }
    ];

    // Filter to only enabled services
    const enabledServices = services.filter(service => service.enabled);
    
    if (enabledServices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No audio recognition services configured. Please add ACRCLOUD_ACCESS_KEY or AUDD_API_TOKEN to environment variables.'
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
            result = await recognizeWithACRCloud(audioFile, service.apiKey!);
            break;
          case 'AudD':
            result = await recognizeWithAudD(audioFile, service.apiKey!);
            break;
          default:
            continue;
        }

        if (result.success && result.track) {
          console.log(`✅ Success with ${service.name}:`, result.track);
          return NextResponse.json(result);
        } else {
          console.log(`❌ No match with ${service.name}`);
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

// ACRCloud (Shazam-like service)
async function recognizeWithACRCloud(audioFile: File, apiKey: string): Promise<RecognitionResult> {
  try {
    console.log('ACRCloud: Converting audio file...');
    
    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBytes = new Uint8Array(arrayBuffer);
    
    // Create form data for ACRCloud
    const formData = new FormData();
    
    // ACRCloud expects the raw audio data
    const audioBlob = new Blob([audioBytes], { type: 'audio/webm' });
    formData.append('sample', audioBlob);
    formData.append('sample_bytes', arrayBuffer.byteLength.toString());
    formData.append('access_key', apiKey);
    
    console.log('ACRCloud: Sending request...');
    
    const response = await fetch('https://identify-us-west-2.acrcloud.com/v1/identify', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`ACRCloud API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('ACRCloud response status:', data.status);
    
    if (data.status.code === 0 && data.metadata?.music?.length > 0) {
      const track = data.metadata.music[0];
      return {
        success: true,
        track: {
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.album?.name,
          confidence: (data.status.score || 80) / 100,
          service: 'ACRCloud'
        }
      };
    }
    
    return { success: false, error: `ACRCloud: ${data.status.msg || 'No match found'}` };
  } catch (error: unknown) {
    console.error('ACRCloud error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `ACRCloud failed: ${message}` };
  }
}

// AudD.io service
async function recognizeWithAudD(audioFile: File, apiKey: string): Promise<RecognitionResult> {
  try {
    console.log('AudD: Preparing request...');
    
    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify');

    console.log('AudD: Sending request...');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`AudD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('AudD response:', data.status);
    
    if (data.status === 'success' && data.result) {
      return {
        success: true,
        track: {
          artist: data.result.artist || 'Unknown Artist',
          title: data.result.title || 'Unknown Title',
          album: data.result.album,
          confidence: 0.8, // AudD doesn't provide confidence scores
          service: 'AudD'
        }
      };
    }
    
    return { success: false, error: 'AudD: No match found' };
  } catch (error: unknown) {
    console.error('AudD error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `AudD failed: ${message}` };
  }
}

export async function GET(): Promise<NextResponse> {
  // Check which services are configured
  const services = [
    { name: 'ACRCloud', enabled: !!process.env.ACRCLOUD_ACCESS_KEY },
    { name: 'AudD', enabled: !!process.env.AUDD_API_TOKEN }
  ];

  const enabledServices = services.filter(s => s.enabled);
  const disabledServices = services.filter(s => !s.enabled);

  return NextResponse.json({ 
    message: 'Multi-Service Audio Recognition API',
    enabledServices: enabledServices.map(s => s.name),
    disabledServices: disabledServices.map(s => s.name),
    usage: 'POST audio file - will try services in order: ACRCloud → AudD',
    envVariablesNeeded: [
      'ACRCLOUD_ACCESS_KEY (recommended)',
      'AUDD_API_TOKEN (fallback)'
    ]
  });
}