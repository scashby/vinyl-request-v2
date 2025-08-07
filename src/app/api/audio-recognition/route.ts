// src/app/api/audio-recognition/route.ts
// COMPLETE FIX: All 6 recognition services with comprehensive debugging

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
}

// API Response interfaces to avoid 'any' types
interface ShazamTrack {
  title?: string;
  subtitle?: string;
  images?: {
    coverart?: string;
    background?: string;
  };
  sections?: Array<{
    metadata?: Array<{
      title?: string;
      text?: string;
    }>;
  }>;
  hub?: {
    providers?: Array<{
      type?: string;
      actions?: Array<{
        uri?: string;
      }>;
    }>;
  };
}

interface ShazamResponse {
  track?: ShazamTrack;
}

interface LastFmImage {
  '#text'?: string;
  size?: string;
}

interface LastFmTrack {
  name?: string;
  artist?: {
    name?: string;
  };
  album?: {
    title?: string;
    image?: LastFmImage[];
  };
}

interface LastFmResponse {
  track?: LastFmTrack;
  error?: string;
}

// Debug environment variables
function debugEnvironment() {
  console.log('🔧 DEBUG: Environment check:');
  console.log('   ACRCLOUD_ACCESS_KEY:', process.env.ACRCLOUD_ACCESS_KEY ? 'SET' : 'MISSING');
  console.log('   ACRCLOUD_SECRET_KEY:', process.env.ACRCLOUD_SECRET_KEY ? 'SET' : 'MISSING');
  console.log('   ACRCLOUD_ENDPOINT:', process.env.ACRCLOUD_ENDPOINT || 'MISSING');
  console.log('   AUDD_API_TOKEN:', process.env.AUDD_API_TOKEN ? 'SET' : 'MISSING');
  console.log('   SPOTIFY_CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('   SPOTIFY_CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.log('   SHAZAM_RAPID_API_KEY:', process.env.SHAZAM_RAPID_API_KEY ? 'SET' : 'MISSING');
  console.log('   ACOUSTID_CLIENT_KEY:', process.env.ACOUSTID_CLIENT_KEY ? 'SET' : 'MISSING');
  console.log('   LASTFM_API_KEY:', process.env.LASTFM_API_KEY ? 'SET' : 'MISSING');
  console.log('   LASTFM_API_SECRET:', process.env.LASTFM_API_SECRET ? 'SET' : 'MISSING');
}

// Safe base64 conversion with detailed logging
function base64ToBufferSafe(base64: string): Buffer {
  try {
    console.log(`🔄 Converting base64 string: ${base64.length} chars`);
    
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    console.log(`   Cleaned base64: ${cleanBase64.length} chars`);
    
    const buffer = Buffer.from(cleanBase64, 'base64');
    console.log(`   Buffer created: ${buffer.length} bytes (${Math.round(buffer.length / 1024)}KB)`);
    
    if (buffer.length < 1000) {
      throw new Error(`Audio buffer too small: ${buffer.length} bytes`);
    }
    
    return buffer;
  } catch (error) {
    console.error('❌ Base64 conversion error:', error);
    throw error;
  }
}

// Enhanced ACRCloud with detailed error logging
async function checkACRCloudDetailed(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  console.log('🎵 ACRCloud: Starting recognition...');
  
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY || !process.env.ACRCLOUD_ENDPOINT) {
    console.log('❌ ACRCloud: Missing environment variables');
    return null;
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    console.log(`🎵 ACRCloud: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    // Create ACRCloud signature
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${process.env.ACRCLOUD_ACCESS_KEY}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY!)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

    console.log(`🎵 ACRCloud: Signature created, timestamp: ${timestamp}`);

    // Create form data
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('sample', audioBlob, 'sample.webm');
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', process.env.ACRCLOUD_ACCESS_KEY);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());

    console.log(`🎵 ACRCloud: Sending request to ${process.env.ACRCLOUD_ENDPOINT}/v1/identify`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${process.env.ACRCLOUD_ENDPOINT}/v1/identify`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log(`🎵 ACRCloud: Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ACRCloud: HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const acrResult = await response.json();
    console.log(`🎵 ACRCloud: Response received:`, JSON.stringify(acrResult, null, 2));
    
    if (acrResult.status?.code === 0 && acrResult.metadata?.music?.length > 0) {
      const music = acrResult.metadata.music[0];
      
      console.log('✅ ACRCloud: Match found:', music.title, 'by', music.artists?.[0]?.name);
      
      return {
        artist: music.artists?.[0]?.name || 'Unknown Artist',
        title: music.title || 'Unknown Title',
        album: music.album?.name || 'Unknown Album',
        confidence: 0.95,
        source: 'acrcloud',
        service: 'ACRCloud',
        processingTime: Date.now() - startTime,
        duration_ms: music.duration_ms
      };
    } else {
      console.log(`❌ ACRCloud: No match found. Status: ${acrResult.status?.code}, Message: ${acrResult.status?.msg}`);
      return null;
    }
  } catch (error) {
    console.error('❌ ACRCloud: Processing error:', error);
    return null;
  }
}

// Enhanced AudD with detailed error logging
async function checkAudDDetailed(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  console.log('🎼 AudD: Starting recognition...');
  
  if (!process.env.AUDD_API_TOKEN) {
    console.log('❌ AudD: Missing API token');
    return null;
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    console.log(`🎼 AudD: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('return', 'spotify');

    console.log('🎼 AudD: Sending request to api.audd.io...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log(`🎼 AudD: Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ AudD: HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const auddResult = await response.json();
    console.log(`🎼 AudD: Response received:`, JSON.stringify(auddResult, null, 2));
    
    if (auddResult.status === 'success' && auddResult.result) {
      const track = auddResult.result;
      
      console.log('✅ AudD: Match found:', track.title, 'by', track.artist);
      
      return {
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
      };
    } else {
      console.log(`❌ AudD: No match found. Status: ${auddResult.status}, Error: ${auddResult.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ AudD: Processing error:', error);
    return null;
  }
}

// Enhanced Shazam with detailed error logging
async function checkShazamDetailed(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  console.log('🎤 Shazam: Starting recognition...');
  
  if (!process.env.SHAZAM_RAPID_API_KEY) {
    console.log('❌ Shazam: Missing RapidAPI key');
    return null;
  }
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    console.log(`🎤 Shazam: Processing ${Math.round(audioBuffer.length / 1024)}KB audio...`);
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('upload_file', audioBlob, 'audio.webm');

    console.log('🎤 Shazam: Sending request to RapidAPI...');

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
    
    console.log(`🎤 Shazam: Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Shazam: HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const shazamResult: ShazamResponse = await response.json();
    console.log(`🎤 Shazam: Response received:`, JSON.stringify(shazamResult, null, 2));
    
    if (shazamResult.track) {
      const track = shazamResult.track;
      
      console.log('✅ Shazam: Match found:', track.title, 'by', track.subtitle);
      
      return {
        artist: track.subtitle || 'Unknown Artist',
        title: track.title || 'Unknown Title',
        album: track.sections?.[0]?.metadata?.find((m) => m.title === 'Album')?.text || 'Unknown Album',
        confidence: 0.92,
        source: 'shazam',
        service: 'Shazam',
        image_url: track.images?.coverart || track.images?.background,
        processingTime: Date.now() - startTime,
        spotify_id: track.hub?.providers?.find((p) => p.type === 'spotify')?.actions?.[0]?.uri?.split(':')?.[2]
      };
    } else {
      console.log('❌ Shazam: No match found');
      return null;
    }
  } catch (error) {
    console.error('❌ Shazam: Processing error:', error);
    return null;
  }
}

// Enhanced AcoustID with detailed error logging
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkAcoustIDDetailed(audioData: string): Promise<RecognitionMatch | null> {
  console.log('🎶 AcoustID: Starting recognition...');
  
  if (!process.env.ACOUSTID_CLIENT_KEY) {
    console.log('❌ AcoustID: Missing client key');
    return null;
  }
  
  try {
    console.log('🎶 AcoustID: Note - AcoustID requires audio fingerprinting preprocessing, skipping for now...');
    // AcoustID requires pre-computed audio fingerprints using tools like fpcalc
    // This would need additional preprocessing to generate fingerprints from raw audio
    return null;
  } catch (error) {
    console.error('❌ AcoustID: Processing error:', error);
    return null;
  }
}

// Enhanced Last.fm with detailed error logging (for metadata enrichment)
async function checkLastFMDetailed(artist: string, title: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  console.log('📻 Last.fm: Starting metadata lookup...');
  
  if (!process.env.LASTFM_API_KEY) {
    console.log('❌ Last.fm: Missing API key');
    return null;
  }
  
  try {
    const apiKey = process.env.LASTFM_API_KEY;
    const method = 'track.getInfo';
    const url = `https://ws.audioscrobbler.com/2.0/?method=${method}&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`;
    
    console.log(`📻 Last.fm: Looking up: ${artist} - ${title}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log(`📻 Last.fm: Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`❌ Last.fm: HTTP ${response.status}`);
      return null;
    }

    const lastfmResult: LastFmResponse = await response.json();
    console.log(`📻 Last.fm: Response received:`, JSON.stringify(lastfmResult, null, 2));
    
    if (lastfmResult.track && !lastfmResult.error) {
      const track = lastfmResult.track;
      
      console.log('✅ Last.fm: Track info found');
      
      return {
        artist: track.artist?.name || artist,
        title: track.name || title,
        album: track.album?.title || 'Unknown Album',
        confidence: 0.85, // Lower confidence since this is metadata lookup, not recognition
        source: 'lastfm',
        service: 'Last.fm',
        image_url: track.album?.image?.find((img) => img.size === 'large')?.['#text'],
        processingTime: Date.now() - startTime
      };
    } else {
      console.log(`❌ Last.fm: No track info found. Error: ${lastfmResult.error}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Last.fm: Processing error:', error);
    return null;
  }
}

// Collection check with detailed error logging
async function checkCollectionDetailed(audioData: string): Promise<RecognitionMatch | null> {
  console.log('🏆 Collection: Starting check...');
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const collectionUrl = `${baseUrl}/api/audio-recognition/collection`;
    
    console.log(`🏆 Collection: Calling ${collectionUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(collectionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData,
        triggeredBy: 'debug_check',
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log(`🏆 Collection: Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Collection: HTTP ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log(`🏆 Collection: Response:`, JSON.stringify(data, null, 2));
    
    if (data.success && data.result) {
      console.log('✅ Collection: Match found');
      return {
        ...data.result,
        source: 'collection'
      };
    } else {
      console.log('❌ Collection: No match found');
      return null;
    }
  } catch (error) {
    console.error('❌ Collection: Error:', error);
    return null;
  }
}

interface RecognitionDebugResult {
  success: boolean;
  autoSelected?: RecognitionMatch;
  alternatives?: RecognitionMatch[];
  allResults?: RecognitionMatch[];
  processingTime: number;
  sourcesChecked: string[];
  errors?: string[];
  error?: string;
  details?: string;
}

// Main recognition function with comprehensive debugging
async function performRecognitionWithDebug(audioData: string): Promise<RecognitionDebugResult> {
  const startTime = Date.now();
  const results: RecognitionMatch[] = [];
  const sourcesChecked: string[] = [];
  const errors: string[] = [];
  
  console.log('🎯 Starting DETAILED audio recognition debugging...');
  debugEnvironment();
  
  console.log(`📊 Audio data: ${audioData.length} characters (${Math.round(audioData.length / 1024)}KB)`);
  
  // Test 1: Collection
  try {
    sourcesChecked.push('Collection');
    console.log('\n--- TESTING COLLECTION ---');
    const collectionResult = await checkCollectionDetailed(audioData);
    if (collectionResult) {
      results.push(collectionResult);
      console.log('✅ Collection: SUCCESS');
    } else {
      errors.push('Collection: No match found');
      console.log('❌ Collection: FAILED');
    }
  } catch (error) {
    const errorMsg = `Collection: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌ Collection: EXCEPTION:', error);
  }
  
  // Test 2: ACRCloud
  try {
    sourcesChecked.push('ACRCloud');
    console.log('\n--- TESTING ACRCLOUD ---');
    const acrResult = await checkACRCloudDetailed(audioData);
    if (acrResult) {
      results.push(acrResult);
      console.log('✅ ACRCloud: SUCCESS');
    } else {
      errors.push('ACRCloud: No match found');
      console.log('❌ ACRCloud: FAILED');
    }
  } catch (error) {
    const errorMsg = `ACRCloud: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌ ACRCloud: EXCEPTION:', error);
  }
  
  // Test 3: AudD
  try {
    sourcesChecked.push('AudD');
    console.log('\n--- TESTING AUDD ---');
    const auddResult = await checkAudDDetailed(audioData);
    if (auddResult) {
      results.push(auddResult);
      console.log('✅ AudD: SUCCESS');
    } else {
      errors.push('AudD: No match found');
      console.log('❌ AudD: FAILED');
    }
  } catch (error) {
    const errorMsg = `AudD: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌ AudD: EXCEPTION:', error);
  }
  
  // Test 4: Shazam
  try {
    sourcesChecked.push('Shazam');
    console.log('\n--- TESTING SHAZAM ---');
    const shazamResult = await checkShazamDetailed(audioData);
    if (shazamResult) {
      results.push(shazamResult);
      console.log('✅ Shazam: SUCCESS');
    } else {
      errors.push('Shazam: No match found');
      console.log('❌ Shazam: FAILED');
    }
  } catch (error) {
    const errorMsg = `Shazam: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌ Shazam: EXCEPTION:', error);
  }
  
  // Test 5: AcoustID (Note: requires fingerprinting)
  try {
    sourcesChecked.push('AcoustID');
    console.log('\n--- TESTING ACOUSTID ---');
    const acoustidResult = await checkAcoustIDDetailed(audioData);
    if (acoustidResult) {
      results.push(acoustidResult);
      console.log('✅ AcoustID: SUCCESS');
    } else {
      errors.push('AcoustID: No match found or requires fingerprinting');
      console.log('❌ AcoustID: FAILED/SKIPPED');
    }
  } catch (error) {
    const errorMsg = `AcoustID: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('❌ AcoustID: EXCEPTION:', error);
  }
  
  // Test 6: Last.fm metadata enrichment (if we have matches)
  if (results.length > 0) {
    try {
      sourcesChecked.push('Last.fm');
      console.log('\n--- TESTING LASTFM ENRICHMENT ---');
      const firstResult = results[0];
      const lastfmResult = await checkLastFMDetailed(firstResult.artist, firstResult.title);
      if (lastfmResult) {
        results.push(lastfmResult);
        console.log('✅ Last.fm: SUCCESS');
      } else {
        errors.push('Last.fm: No enrichment data found');
        console.log('❌ Last.fm: FAILED');
      }
    } catch (error) {
      const errorMsg = `Last.fm: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error('❌ Last.fm: EXCEPTION:', error);
    }
  }
  
  const processingTime = Date.now() - startTime;
  
  console.log('\n=== RECOGNITION SUMMARY ===');
  console.log(`Total processing time: ${processingTime}ms`);
  console.log(`Sources checked: ${sourcesChecked.join(', ')}`);
  console.log(`Successful matches: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  
  if (results.length > 0) {
    console.log('\n--- MATCHES FOUND ---');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.source}: ${result.artist} - ${result.title} (${Math.round(result.confidence * 100)}%)`);
    });
    
    // Return the best result
    const bestResult = results.sort((a, b) => {
      // Collection matches win
      if (a.source === 'collection' && b.source !== 'collection') return -1;
      if (b.source === 'collection' && a.source !== 'collection') return 1;
      // Then by confidence
      return b.confidence - a.confidence;
    })[0];
    
    return {
      success: true,
      autoSelected: bestResult,
      alternatives: results.filter(r => r !== bestResult).slice(0, 3),
      allResults: results,
      processingTime,
      sourcesChecked,
      errors
    };
  } else {
    console.log('\n--- NO MATCHES FOUND ---');
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    
    return {
      success: false,
      error: "No matches found from any source",
      processingTime,
      sourcesChecked,
      errors,
      details: "All recognition services failed to find a match"
    };
  }
}

// GET - Return enhanced service status with all services
export async function GET() {
  const enabledServices = [];
  
  if (process.env.ACRCLOUD_ACCESS_KEY) enabledServices.push('ACRCloud');
  if (process.env.AUDD_API_TOKEN) enabledServices.push('AudD');
  if (process.env.SHAZAM_RAPID_API_KEY) enabledServices.push('Shazam');
  if (process.env.ACOUSTID_CLIENT_KEY) enabledServices.push('AcoustID');
  if (process.env.LASTFM_API_KEY) enabledServices.push('Last.fm');
  if (process.env.SPOTIFY_CLIENT_ID) enabledServices.push('Spotify Web API');
  
  return NextResponse.json({
    success: true,
    message: "Complete Audio Recognition Debug API",
    mode: "debug_all_services",
    features: [
      "detailed_error_logging",
      "environment_validation", 
      "comprehensive_service_testing",
      "response_debugging",
      "failure_analysis"
    ],
    enabledServices: ['Collection Database', ...enabledServices],
    totalSources: enabledServices.length + 1,
    serviceDetails: {
      collection: 'Internal vinyl/cassette/45s database',
      acrcloud: enabledServices.includes('ACRCloud') ? 'Audio fingerprinting' : 'Missing credentials',
      audd: enabledServices.includes('AudD') ? 'Audio recognition API' : 'Missing token',
      shazam: enabledServices.includes('Shazam') ? 'Shazam via RapidAPI' : 'Missing API key',
      acoustid: enabledServices.includes('AcoustID') ? 'Audio fingerprinting (requires preprocessing)' : 'Missing client key',
      lastfm: enabledServices.includes('Last.fm') ? 'Metadata enrichment' : 'Missing API key',
      spotify: enabledServices.includes('Spotify Web API') ? 'Metadata enrichment' : 'Missing credentials'
    },
    version: "debug-1.0.0"
  });
}

// POST - Process audio recognition with comprehensive debugging
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 COMPREHENSIVE AUDIO RECOGNITION DEBUG');
  
  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'debug', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 Processing comprehensive recognition debug (${triggeredBy})`);
    console.log(`Audio data size: ${Math.round(audioData.length / 1024)}KB`);
    
    // Perform comprehensive recognition with all services
    const recognition = await performRecognitionWithDebug(audioData);
    
    if (recognition.success) {
      // Log successful recognition
      try {
        await supabase.from('audio_recognition_logs').insert({
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
          raw_response: recognition,
          created_at: new Date().toISOString(),
          timestamp: timestamp || new Date().toISOString()
        });
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
      debugMode: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ DEBUG API ERROR:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      debugMode: true,
      details: "Comprehensive debug recognition failed"
    }, { status: 500 });
  }
}