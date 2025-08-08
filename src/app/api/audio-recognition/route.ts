// src/app/api/audio-recognition/route.ts
// FIXED VERSION: Individual service results, not lumped together

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
  source: 'collection' | 'acrcloud' | 'audd' | 'acoustid' | 'shazam' | 'spotify';
  service: string;
  image_url?: string;
  albumId?: number;
  processingTime: number;
  spotify_id?: string;
  duration_ms?: number;
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

// Shazam API interfaces for proper typing
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

// Safe base64 conversion
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

// Individual service functions with proper error handling

async function checkCollection(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  try {
    // Fix URL construction for Vercel deployments
    let baseUrl: string;
    
    if (process.env.VERCEL_URL) {
      // On Vercel, use VERCEL_URL (automatically provided)
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXTAUTH_URL) {
      // Use NEXTAUTH_URL if set
      baseUrl = process.env.NEXTAUTH_URL;
    } else {
      // Fallback for local development
      baseUrl = 'http://localhost:3000';
    }
    
    const collectionUrl = `${baseUrl}/api/audio-recognition/collection`;
    
    console.log(`🏆 Collection calling ${collectionUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(collectionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData,
        triggeredBy: 'main_recognition',
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Collection HTTP ${response.status}: ${errorText}`);
      
      return {
        service: 'Collection',
        status: 'error',
        error: `HTTP ${response.status}: ${errorText.substring(0, 50)}...`,
        processingTime: Date.now() - startTime
      };
    }

    const data = await response.json();
    
    if (data.success && data.result) {
      return {
        service: 'Collection',
        status: 'success',
        result: {
          ...data.result,
          source: 'collection',
          processingTime: Date.now() - startTime
        },
        processingTime: Date.now() - startTime
      };
    } else {
      return {
        service: 'Collection',
        status: 'failed',
        error: 'No match found in collection',
        processingTime: Date.now() - startTime
      };
    }
  } catch (error) {
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
    
    // Ensure ACRCloud endpoint has proper protocol
    let endpoint = process.env.ACRCLOUD_ENDPOINT!;
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    
    console.log(`🎵 ACRCloud using endpoint: ${endpoint}`);
    
    // Create ACRCloud signature
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
      return {
        service: 'ACRCloud',
        status: 'failed',
        error: `No match found (Status: ${acrResult.status?.code})`,
        processingTime: Date.now() - startTime
      };
    }
  } catch (error) {
    return {
      service: 'ACRCloud',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

async function checkAudD(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.AUDD_API_TOKEN) {
    return {
      service: 'AudD',
      status: 'skipped',
      error: 'Missing API token',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    formData.append('audio', audioBlob, 'audio.mp3');
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('return', 'spotify');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return {
        service: 'AudD',
        status: 'error',
        error: `HTTP ${response.status}`,
        processingTime: Date.now() - startTime
      };
    }

    const auddResult = await response.json();
    
    if (auddResult.status === 'success' && auddResult.result) {
      const track = auddResult.result;
      
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
          image_url: track.spotify?.album?.images?.[0]?.url,
          processingTime: Date.now() - startTime,
          spotify_id: track.spotify?.id,
          duration_ms: track.spotify?.duration_ms
        },
        processingTime: Date.now() - startTime
      };
    } else {
      return {
        service: 'AudD',
        status: 'failed',
        error: auddResult.error || 'No match found',
        processingTime: Date.now() - startTime
      };
    }
  } catch (error) {
    return {
      service: 'AudD',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

async function checkShazam(audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  if (!process.env.SHAZAM_RAPID_API_KEY) {
    return {
      service: 'Shazam',
      status: 'skipped',
      error: 'Missing RapidAPI key',
      processingTime: Date.now() - startTime
    };
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    formData.append('upload_file', audioBlob, 'audio.mp3');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://shazam-song-recognizer.p.rapidapi.com/recognize/file', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': process.env.SHAZAM_RAPID_API_KEY,
        'X-RapidAPI-Host': 'shazam-song-recognizer.p.rapidapi.com'
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(`Shazam HTTP ${response.status}: ${errorText}`);
      
      // Handle specific error codes
      let errorMessage = `HTTP ${response.status}`;
      if (response.status === 403) {
        errorMessage = 'API key invalid or quota exceeded';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded';
      }
      
      return {
        service: 'Shazam',
        status: 'error',
        error: errorMessage,
        processingTime: Date.now() - startTime
      };
    }

    const shazamResult: ShazamResponse = await response.json();
    
    if (shazamResult.track) {
      const track = shazamResult.track;
      
      // Find album from metadata
      const albumMetadata = track.sections?.[0]?.metadata?.find((m: ShazamMetadata) => m.title === 'Album');
      
      // Find Spotify ID from providers
      const spotifyProvider = track.hub?.providers?.find((p: ShazamProvider) => p.type === 'spotify');
      const spotifyId = spotifyProvider?.actions?.[0]?.uri?.split(':')?.[2];
      
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
      return {
        service: 'Shazam',
        status: 'failed',
        error: 'No match found',
        processingTime: Date.now() - startTime
      };
    }
  } catch (error) {
    return {
      service: 'Shazam',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkAcoustID(_audioData: string): Promise<ServiceResult> {
  const startTime = Date.now();
  
  // AcoustID requires audio preprocessing - skip for now
  // Note: _audioData is prefixed with underscore to indicate it's intentionally unused
  return {
    service: 'AcoustID',
    status: 'skipped',
    error: 'Requires audio preprocessing (not implemented)',
    processingTime: Date.now() - startTime
  };
}

// Main recognition function
async function performRecognition(audioData: string): Promise<RecognitionResponse> {
  const startTime = Date.now();
  const serviceResults: ServiceResult[] = [];
  const successfulResults: RecognitionMatch[] = [];
  
  console.log('🎵 Starting individual service recognition...');
  console.log('🌐 Environment check:', {
    VERCEL_URL: process.env.VERCEL_URL ? 'SET' : 'NOT_SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET' : 'NOT_SET',
    ACRCLOUD_ENDPOINT: process.env.ACRCLOUD_ENDPOINT ? 'SET' : 'NOT_SET'
  });
  
  // Check each service individually and log results immediately
  
  // 1. Collection
  console.log('🏆 Checking Collection...');
  const collectionResult = await checkCollection(audioData);
  serviceResults.push(collectionResult);
  console.log(`🏆 Collection result: ${collectionResult.status} - ${collectionResult.error || 'Match found'}`);
  if (collectionResult.status === 'success' && collectionResult.result) {
    successfulResults.push(collectionResult.result);
  }
  
  // 2. ACRCloud
  console.log('🎵 Checking ACRCloud...');
  const acrResult = await checkACRCloud(audioData);
  serviceResults.push(acrResult);
  console.log(`🎵 ACRCloud result: ${acrResult.status} - ${acrResult.error || 'Match found'}`);
  if (acrResult.status === 'success' && acrResult.result) {
    successfulResults.push(acrResult.result);
  }
  
  // 3. AudD
  console.log('🎼 Checking AudD...');
  const auddResult = await checkAudD(audioData);
  serviceResults.push(auddResult);
  console.log(`🎼 AudD result: ${auddResult.status} - ${auddResult.error || 'Match found'}`);
  if (auddResult.status === 'success' && auddResult.result) {
    successfulResults.push(auddResult.result);
  }
  
  // 4. Shazam
  console.log('🎤 Checking Shazam...');
  const shazamResult = await checkShazam(audioData);
  serviceResults.push(shazamResult);
  console.log(`🎤 Shazam result: ${shazamResult.status} - ${shazamResult.error || 'Match found'}`);
  if (shazamResult.status === 'success' && shazamResult.result) {
    successfulResults.push(shazamResult.result);
  }
  
  // 5. AcoustID (skipped for now)
  console.log('🔍 Checking AcoustID...');
  const acoustidResult = await checkAcoustID(audioData);
  serviceResults.push(acoustidResult);
  console.log(`🔍 AcoustID result: ${acoustidResult.status} - ${acoustidResult.error || 'Match found'}`);
  
  const processingTime = Date.now() - startTime;
  
  console.log(`\n=== Recognition Summary ===`);
  console.log(`Total processing time: ${processingTime}ms`);
  console.log(`Services checked: ${serviceResults.length}`);
  console.log(`Successful matches: ${successfulResults.length}`);
  
  if (successfulResults.length > 0) {
    // Select best result (collection wins, then by confidence)
    const autoSelected = successfulResults.sort((a, b) => {
      if (a.source === 'collection' && b.source !== 'collection') return -1;
      if (b.source === 'collection' && a.source !== 'collection') return 1;
      return b.confidence - a.confidence;
    })[0];
    
    const alternatives = successfulResults.filter(r => r !== autoSelected).slice(0, 3);
    
    console.log(`✅ Auto-selected: ${autoSelected.source} - ${autoSelected.artist} - ${autoSelected.title}`);
    
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
    console.log('❌ No matches found from any service');
    
    return {
      success: false,
      error: 'No matches found from any service',
      serviceResults,
      processingTime
    };
  }
}

// GET - Service status with collection test
export async function GET() {
  try {
    console.log('🏆 Audio Recognition API GET - testing all services');
    
    // Test collection database connection
    const { count, error } = await supabase
      .from('collection')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Collection DB error:', error);
    }
    
    const enabledServices = [];
    
    if (process.env.ACRCLOUD_ACCESS_KEY) enabledServices.push('ACRCloud');
    if (process.env.AUDD_API_TOKEN) enabledServices.push('AudD');
    if (process.env.SHAZAM_RAPID_API_KEY) enabledServices.push('Shazam');
    if (process.env.ACOUSTID_CLIENT_KEY) enabledServices.push('AcoustID');
    
    return NextResponse.json({
      success: true,
      message: "FIXED: Individual Service Results Audio Recognition API",
      version: "individual-results-1.0.0",
      timestamp: new Date().toISOString(),
      features: ['individual_service_results', 'detailed_logging', 'real_audio_processing'],
      enabledServices: ['Collection Database', ...enabledServices],
      collectionSize: error ? 'ERROR' : (count || 0),
      environment: {
        VERCEL: process.env.VERCEL ? 'YES' : 'NO',
        VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
        NODE_ENV: process.env.NODE_ENV
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Service test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Process audio recognition
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  console.log('🚨 FIXED VERSION: Individual service results, not lumped together');
  console.log('🌍 Deployment environment:', {
    VERCEL: process.env.VERCEL ? 'YES' : 'NO',
    VERCEL_ENV: process.env.VERCEL_ENV || 'NOT_SET',
    VERCEL_URL: process.env.VERCEL_URL ? `SET (${process.env.VERCEL_URL})` : 'NOT_SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? `SET (${process.env.NEXTAUTH_URL})` : 'NOT_SET',
    NODE_ENV: process.env.NODE_ENV
  });
  
  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 Processing individual service recognition (${triggeredBy})`);
    console.log(`🎵 Audio data size: ${Math.round(audioData.length / 1024)}KB`);
    
    // Perform recognition with individual service results
    const recognition = await performRecognition(audioData);
    
    if (recognition.success && recognition.autoSelected) {
      console.log('✅ Recognition successful, updating database...');
      
      // Log successful recognition
      try {
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
          now_playing: false,
          raw_response: {
            success: recognition.success,
            autoSelected: recognition.autoSelected,
            alternatives: recognition.alternatives || [],
            processingTime: recognition.processingTime,
            individualResults: true
          },
          created_at: new Date().toISOString(),
          timestamp: timestamp || new Date().toISOString()
        };
        
        await supabase.from('audio_recognition_logs').insert(logData);
      } catch (logError) {
        console.error('Failed to log recognition:', logError);
      }
      
      // Update now_playing
      try {
        await supabase.from('now_playing').upsert({
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
        });
        
        console.log('✅ Now playing updated successfully');
      } catch (updateError) {
        console.error('Failed to update now playing:', updateError);
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    
    return NextResponse.json({
      ...recognition,
      totalProcessingTime,
      triggeredBy,
      individualResults: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('API ERROR:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      serviceResults: []
    }, { status: 500 });
  }
}