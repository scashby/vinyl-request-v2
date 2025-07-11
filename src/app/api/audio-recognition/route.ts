// src/app/api/audio-recognition/route.ts - Enhanced with candidates
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface RecognitionTrack {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
}

interface RecognitionResult {
  success: boolean;
  track?: RecognitionTrack;
  candidates?: RecognitionTrack[]; // Additional matches for correction
  error?: string;
}

interface ServiceConfig {
  name: string;
  apiKey: string | undefined;
  enabled: boolean;
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

// Enhanced ACRCloud with candidates and image extraction
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

    const data: ACRCloudResponse = await response.json();
    console.log('ACRCloud response:', JSON.stringify(data, null, 2));
    
    if (data.status?.code === 0 && data.metadata?.music && data.metadata.music.length > 0) {
      const tracks = data.metadata.music;
      
      // Extract artwork URL from various sources
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
      
      // Convert all tracks to our format
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
      // Extract artwork from external metadata
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
    }
  ];

  const enabledServices = services.filter(s => s.enabled);
  const disabledServices = services.filter(s => !s.enabled);

  return NextResponse.json({ 
    message: 'Enhanced Multi-Service Audio Recognition API',
    enabledServices: enabledServices.map(s => s.name),
    disabledServices: disabledServices.map(s => `${s.name} (${s.config})`),
    features: [
      'Multiple recognition candidates for correction',
      'Album artwork extraction from Spotify/Apple/Deezer',
      'Fallback service ordering',
      'Enhanced error reporting'
    ]
  });
}