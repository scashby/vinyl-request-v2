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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const service = formData.get('service') as string | null;
    const apiKey = formData.get('apiKey') as string | null;

    if (!audioFile || !service || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    let result: RecognitionResult;
    
    switch (service) {
      case 'shazam':
        result = await recognizeWithACRCloud(audioFile, apiKey);
        break;
      case 'audd':
        result = await recognizeWithAudD(audioFile, apiKey);
        break;
      case 'gracenote':
        result = await recognizeWithGracenote();
        break;
      case 'spotify':
        result = await recognizeWithSpotify();
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Unsupported service' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
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
    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    const formData = new FormData();
    formData.append('sample', base64Audio);
    formData.append('sample_bytes', arrayBuffer.byteLength.toString());
    formData.append('access_key', apiKey);
    
    const response = await fetch('https://identify-us-west-2.acrcloud.com/v1/identify', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (data.status.code === 0 && data.metadata.music.length > 0) {
      const track = data.metadata.music[0];
      return {
        success: true,
        track: {
          artist: track.artists[0].name,
          title: track.title,
          album: track.album?.name,
          confidence: data.status.score || 0.8,
          service: 'ACRCloud'
        }
      };
    }
    
    return { success: false, error: 'No match found' };
  } catch (error) {
    console.error('ACRCloud error:', error);
    return { success: false, error: 'Recognition failed' };
  }
}

// AudD.io service
async function recognizeWithAudD(audioFile: File, apiKey: string): Promise<RecognitionResult> {
  try {
    const formData = new FormData();
    formData.append('api_token', apiKey);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    
    if (data.status === 'success' && data.result) {
      return {
        success: true,
        track: {
          artist: data.result.artist,
          title: data.result.title,
          album: data.result.album,
          confidence: 0.8, // AudD doesn't provide confidence scores
          service: 'AudD'
        }
      };
    }
    
    return { success: false, error: 'No match found' };
  } catch (error) {
    console.error('AudD error:', error);
    return { success: false, error: 'Recognition failed' };
  }
}

// Gracenote service (placeholder - requires more complex setup)
async function recognizeWithGracenote(): Promise<RecognitionResult> {
  // Gracenote requires fingerprinting on client side
  // This is a simplified placeholder
  return { success: false, error: 'Gracenote integration requires client-side fingerprinting' };
}

// Spotify Web API (for comparison/metadata enhancement)
async function recognizeWithSpotify(): Promise<RecognitionResult> {
  // Spotify doesn't have audio recognition API
  // This would be used for metadata enhancement after recognition
  return { success: false, error: 'Spotify API is for metadata only, not audio recognition' };
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ 
    message: 'Audio Recognition API',
    supportedServices: ['shazam', 'audd', 'gracenote', 'spotify'],
    usage: 'POST audio file with service and apiKey parameters'
  });
}