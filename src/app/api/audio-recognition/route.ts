// src/app/api/audio-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

    // Filter to only enabled services
    const enabledServices = services.filter(service => service.enabled);
    
    if (enabledServices.length === 0) {
      // Check for manual configuration
      const manualService = formData.get('service') as string;
      const manualApiKey = formData.get('apiKey') as string;
      
      if (manualService && manualApiKey) {
        console.log(`Using manual configuration: ${manualService}`);
        
        let result: RecognitionResult;
        
        switch (manualService) {
          case 'shazam':
            result = await recognizeWithACRCloudManual(audioFile, manualApiKey);
            break;
          case 'audd':
            result = await recognizeWithAudD(audioFile, manualApiKey);
            break;
          default:
            return NextResponse.json({
              success: false,
              error: 'Invalid manual service specified'
            }, { status: 400 });
        }
        
        return NextResponse.json(result);
      }
      
      return NextResponse.json({
        success: false,
        error: 'No audio recognition services configured. Please add environment variables or provide manual configuration.'
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

// ACRCloud with full environment configuration
async function recognizeWithACRCloud(audioFile: File): Promise<RecognitionResult> {
  try {
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY!;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY!;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    console.log('ACRCloud: Converting audio file...');
    
    // Convert audio file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Prepare timestamp and signature
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
    
    // Create form data for ACRCloud
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

    const data = await response.json();
    console.log('ACRCloud response:', JSON.stringify(data, null, 2));
    
    if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
      const track = data.metadata.music[0];
      const confidence = (data.status.score || 80) / 100;
      
      console.log('ACRCloud found track:', track.title, 'by', track.artists?.[0]?.name);
      
      return {
        success: true,
        track: {
          artist: track.artists?.[0]?.name || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.album?.name,
          confidence: confidence,
          service: 'ACRCloud'
        }
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

// ACRCloud with manual API key (simplified for manual config)
async function recognizeWithACRCloudManual(audioFile: File, apiKey: string): Promise<RecognitionResult> {
  try {
    console.log('ACRCloud Manual: Converting audio file...');
    
    // Convert audio file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Create simple form data (without signature for basic tier)
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer], { type: 'audio/wav' }));
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', apiKey);
    
    console.log('ACRCloud Manual: Sending request...');
    
    const response = await fetch('https://identify-us-west-2.acrcloud.com/v1/identify', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ACRCloud Manual API error:', response.status, errorText);
      throw new Error(`ACRCloud API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('ACRCloud Manual response status:', data.status);
    
    if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
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
    
    return { success: false, error: `ACRCloud: ${data.status?.msg || 'No match found'}` };
  } catch (error: unknown) {
    console.error('ACRCloud Manual error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `ACRCloud failed: ${message}` };
  }
}

// AudD.io service (unchanged but with better error handling)
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
    }
  ];

  const enabledServices = services.filter(s => s.enabled);
  const disabledServices = services.filter(s => !s.enabled);

  return NextResponse.json({ 
    message: 'Enhanced Multi-Service Audio Recognition API',
    enabledServices: enabledServices.map(s => s.name),
    disabledServices: disabledServices.map(s => `${s.name} (${s.config})`),
    usage: 'POST audio file - will try services in order: ACRCloud → AudD',
    envVariablesNeeded: [
      'ACRCLOUD_ACCESS_KEY + ACRCLOUD_SECRET_KEY (recommended)',
      'AUDD_API_TOKEN (fallback)',
      'ACRCLOUD_ENDPOINT (optional, defaults to identify-us-west-2.acrcloud.com)'
    ],
    improvements: [
      'Configurable sample duration (5-60 seconds)',
      'Continuous recognition mode',
      'Better audio format handling',
      'Improved ACRCloud signature generation',
      'Enhanced error reporting'
    ]
  });
}