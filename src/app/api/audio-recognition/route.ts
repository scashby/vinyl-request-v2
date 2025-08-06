// src/app/api/audio-recognition/route.ts
// COMPREHENSIVE FIX: All ESLint and TypeScript errors resolved

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RecognitionRequest {
  audioData: string;
  triggeredBy?: string;
  timestamp?: string;
}

interface SpotifyExternalUrls {
  spotify?: string;
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
  isrc?: string;
  spotify_id?: string;
  duration_ms?: number;
  preview_url?: string;
  external_urls?: SpotifyExternalUrls;
}

interface MultiSourceResponse {
  autoSelected: RecognitionMatch;
  alternatives: RecognitionMatch[];
  allResults: RecognitionMatch[];
  processingTime: number;
  sourcesChecked: string[];
}

// Memory limits and validation
const AUDIO_LIMITS = {
  MAX_BASE64_SIZE: 15 * 1024 * 1024, // 15MB base64 limit
  MAX_BUFFER_SIZE: 10 * 1024 * 1024,  // 10MB buffer limit
  MIN_BUFFER_SIZE: 1024,               // 1KB minimum
  TIMEOUT_MS: 30000                    // 30 second timeout
};

// Enhanced timeout wrapper with proper cleanup
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`⏰ Request timeout after ${timeoutMs}ms: ${url}`);
    controller.abort();
  }, timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Stack-safe base64 to buffer conversion
function base64ToBufferSafe(base64: string): Buffer {
  try {
    console.log(`🔄 STACK-SAFE: Converting base64 (${base64.length} chars) to buffer...`);
    
    // Validate input
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 string provided');
    }

    // Size validation BEFORE processing
    if (base64.length > AUDIO_LIMITS.MAX_BASE64_SIZE) {
      throw new Error(`Base64 too large: ${Math.round(base64.length / 1024 / 1024)}MB (max ${Math.round(AUDIO_LIMITS.MAX_BASE64_SIZE / 1024 / 1024)}MB)`);
    }
    
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    
    // Validate cleaned base64
    if (cleanBase64.length === 0) {
      throw new Error('Empty base64 string after cleaning');
    }
    
    // Use Node.js Buffer.from which is memory-efficient for large strings
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Validate output buffer size
    if (buffer.length === 0) {
      throw new Error('Conversion resulted in empty buffer');
    }
    
    if (buffer.length > AUDIO_LIMITS.MAX_BUFFER_SIZE) {
      throw new Error(`Buffer too large: ${Math.round(buffer.length / 1024 / 1024)}MB (max ${Math.round(AUDIO_LIMITS.MAX_BUFFER_SIZE / 1024 / 1024)}MB)`);
    }
    
    if (buffer.length < AUDIO_LIMITS.MIN_BUFFER_SIZE) {
      throw new Error(`Buffer too small: ${buffer.length} bytes (min ${AUDIO_LIMITS.MIN_BUFFER_SIZE})`);
    }
    
    console.log(`✅ STACK-SAFE: Conversion complete: ${Math.round(buffer.length / 1024)}KB`);
    return buffer;
    
  } catch (error) {
    console.error('❌ STACK-SAFE: Base64 conversion failed:', error);
    throw new Error(`Stack-safe base64 conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced memory monitoring
function logMemoryUsage(context: string) {
  if (process.memoryUsage) {
    const usage = process.memoryUsage();
    console.log(`📊 ${context} - Memory: ${Math.round(usage.rss / 1024 / 1024)}MB RSS, ${Math.round(usage.heapUsed / 1024 / 1024)}MB Heap`);
  }
}

// Spotify Web API integration
class SpotifyAPI {
  private static accessToken: string | null = null;
  private static tokenExpiry: number = 0;

  static async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.log('⏭️ Spotify: Missing credentials');
      return null;
    }

    try {
      const response = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      }, 10000);

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
        console.log('✅ Spotify: Access token obtained');
        return this.accessToken;
      }
    } catch (error) {
      console.error('❌ Spotify: Token error:', error);
    }
    
    return null;
  }

  static async searchTrack(artist: string, title: string): Promise<RecognitionMatch | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const startTime = Date.now();
    
    try {
      const query = `artist:"${artist}" track:"${title}"`;
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=US`;
      
      const response = await fetchWithTimeout(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, 8000);

      if (response.ok) {
        const data = await response.json();
        const track = data.tracks?.items?.[0];
        
        if (track) {
          return {
            artist: track.artists[0]?.name || artist,
            title: track.name,
            album: track.album?.name || 'Unknown Album',
            confidence: 0.95,
            source: 'spotify' as const,
            service: 'Spotify Web API',
            image_url: track.album?.images?.[0]?.url,
            processingTime: Date.now() - startTime,
            spotify_id: track.id,
            duration_ms: track.duration_ms,
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            isrc: track.external_ids?.isrc
          };
        }
      }
    } catch (error) {
      console.error('❌ Spotify search error:', error);
    }

    return null;
  }
}

// Enhanced ACRCloud with stack-safe processing
async function checkACRCloudSafe(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY || !process.env.ACRCLOUD_ENDPOINT) {
    console.log('⏭️ ACRCloud: Missing credentials');
    return null;
  }
  
  console.log('🎵 ACRCloud: STACK-SAFE processing...');
  logMemoryUsage('ACRCloud Start');
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    logMemoryUsage('ACRCloud After Buffer Conversion');
    
    console.log(`🎵 ACRCloud: Processing ${Math.round(audioBuffer.length / 1024)}KB...`);
    
    // ACRCloud signature generation
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${process.env.ACRCLOUD_ACCESS_KEY}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

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

    logMemoryUsage('ACRCloud Before Request');

    const timeoutMs = Math.max(AUDIO_LIMITS.TIMEOUT_MS, audioBuffer.length / 1024);
    const response = await fetchWithTimeout(`${process.env.ACRCLOUD_ENDPOINT}/v1/identify`, {
      method: 'POST',
      body: formData
    }, timeoutMs);

    logMemoryUsage('ACRCloud After Request');

    if (response.ok) {
      const acrResult = await response.json();
      logMemoryUsage('ACRCloud After JSON Parse');
      
      if (acrResult.status?.code === 0 && acrResult.metadata?.music?.length > 0) {
        const music = acrResult.metadata.music[0];
        
        console.log('✅ ACRCloud: STACK-SAFE match found:', music.title, 'by', music.artists?.[0]?.name);
        
        // Enhanced with Spotify data
        let spotifyEnhancement = null;
        if (music.artists?.[0]?.name && music.title) {
          try {
            spotifyEnhancement = await Promise.race([
              SpotifyAPI.searchTrack(music.artists[0].name, music.title),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
            ]);
          } catch (error) {
            console.log('⚠️ Spotify enhancement failed:', error instanceof Error ? error.message : 'Unknown');
          }
        }
        
        const acrCloudMatch = {
          artist: music.artists?.[0]?.name || 'Unknown Artist',
          title: music.title || 'Unknown Title',
          album: music.album?.name || spotifyEnhancement?.album || 'Unknown Album',
          confidence: 0.95,
          source: 'acrcloud' as const,
          service: 'ACRCloud',
          image_url: spotifyEnhancement?.image_url,
          processingTime: Date.now() - startTime,
          spotify_id: spotifyEnhancement?.spotify_id,
          duration_ms: music.duration_ms || spotifyEnhancement?.duration_ms,
          isrc: music.external_ids?.isrc
        };
        
        logMemoryUsage('ACRCloud Success Complete');
        return acrCloudMatch;
      } else {
        console.log(`❌ ACRCloud: No match found (status: ${acrResult.status?.code})`);
      }
    } else {
      console.error('❌ ACRCloud: API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ ACRCloud: STACK-SAFE processing error:', error);
    logMemoryUsage('ACRCloud Error');
  }
  
  return null;
}

// Enhanced AudD with stack-safe processing
async function checkAudDSafe(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  if (!process.env.AUDD_API_TOKEN) {
    console.log('⏭️ AudD: Missing API token');
    return null;
  }
  
  console.log('🎼 AudD: STACK-SAFE processing...');
  logMemoryUsage('AudD Start');
  
  try {
    const audioBuffer = base64ToBufferSafe(audioData);
    logMemoryUsage('AudD After Buffer Conversion');
    
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('return', 'spotify');

    logMemoryUsage('AudD Before Request');

    const timeoutMs = Math.max(35000, audioBuffer.length / 1024);
    const response = await fetchWithTimeout('https://api.audd.io/', {
      method: 'POST',
      body: formData
    }, timeoutMs);

    logMemoryUsage('AudD After Request');

    if (response.ok) {
      const auddApiResult = await response.json();
      logMemoryUsage('AudD After JSON Parse');
      
      if (auddApiResult.status === 'success' && auddApiResult.result) {
        const track = auddApiResult.result;
        
        console.log('✅ AudD: STACK-SAFE match found:', track.title, 'by', track.artist);
        
        const auddResult = {
          artist: track.artist || 'Unknown Artist',
          title: track.title || 'Unknown Title',
          album: track.album || 'Unknown Album',
          confidence: 0.90,
          source: 'audd' as const,
          service: 'AudD',
          image_url: track.spotify?.album?.images?.[0]?.url,
          processingTime: Date.now() - startTime,
          spotify_id: track.spotify?.id,
          duration_ms: track.spotify?.duration_ms
        };
        
        logMemoryUsage('AudD Success Complete');
        return auddResult;
      }
    }
  } catch (error) {
    console.error('❌ AudD: STACK-SAFE error:', error);
    logMemoryUsage('AudD Error');
  }
  
  return null;
}

// Collection recognition with enhanced error handling
async function checkCollectionSafe(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  console.log('🏆 Checking collection database (STACK-SAFE)...');
  
  try {
    if (audioData.length > AUDIO_LIMITS.MAX_BASE64_SIZE) {
      console.log('⚠️ Collection: Audio too large for processing');
      return null;
    }
    
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const response = await fetchWithTimeout(`${baseUrl}/api/audio-recognition/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData,
        triggeredBy: 'stack_safe_multi_source',
        timestamp: new Date().toISOString()
      })
    }, 20000);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.result) {
        return {
          ...data.result,
          source: 'collection' as const,
          processingTime: Date.now() - startTime
        };
      }
    }
  } catch (error) {
    console.error('❌ Collection check error:', error);
  }
  
  return null;
}

// Enhanced auto-selection algorithm
function selectBestResultSafe(results: RecognitionMatch[]): RecognitionMatch {
  console.log(`🎯 STACK-SAFE: Auto-selecting from ${results.length} results`);
  
  if (results.length === 0) {
    throw new Error('No results to select from');
  }
  
  // Log all results for debugging
  results.forEach((matchResult, index) => {
    console.log(`   ${index + 1}. ${matchResult.source}: ${matchResult.artist} - ${matchResult.title} (${Math.round(matchResult.confidence * 100)}%)`);
  });
  
  // 1. Collection matches always win
  const collectionMatches = results.filter(r => r.source === 'collection' && r.confidence > 0.7);
  if (collectionMatches.length > 0) {
    const best = collectionMatches.sort((a, b) => b.confidence - a.confidence)[0];
    console.log(`🏆 Collection match selected: ${best.artist} - ${best.title} (${Math.round(best.confidence * 100)}%)`);
    return best;
  }
  
  // 2. High confidence external matches
  const highConfidenceMatches = results.filter(r => r.confidence > 0.9);
  if (highConfidenceMatches.length > 0) {
    const sourcePriority = { acrcloud: 5, audd: 4, spotify: 3, acoustid: 2, shazam: 1 };
    const best = highConfidenceMatches.sort((a, b) => {
      const priorityA = sourcePriority[a.source as keyof typeof sourcePriority] || 0;
      const priorityB = sourcePriority[b.source as keyof typeof sourcePriority] || 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    })[0];
    
    console.log(`🌟 High confidence match: ${best.artist} - ${best.title} (${best.source}, ${Math.round(best.confidence * 100)}%)`);
    return best;
  }
  
  // 3. Fallback to best available
  const fallback = results.sort((a, b) => b.confidence - a.confidence)[0];
  console.log(`⚠️ Fallback selection: ${fallback.artist} - ${fallback.title} (${Math.round(fallback.confidence * 100)}%)`);
  return fallback;
}

// Stack-safe multi-source recognition engine
async function performMultiSourceRecognitionSafe(audioData: string): Promise<MultiSourceResponse> {
  const startTime = Date.now();
  const results: RecognitionMatch[] = [];
  const sourcesChecked: string[] = [];
  
  console.log('🎯 Starting STACK-SAFE multi-source recognition...');
  logMemoryUsage('Multi-Source Start');
  
  // Validate audio data
  if (!audioData || audioData.length === 0) {
    throw new Error('No audio data provided');
  }
  
  if (audioData.length > AUDIO_LIMITS.MAX_BASE64_SIZE) {
    throw new Error(`Audio data too large: ${Math.round(audioData.length / 1024 / 1024)}MB (max ${Math.round(AUDIO_LIMITS.MAX_BASE64_SIZE / 1024 / 1024)}MB)`);
  }
  
  console.log(`📊 STACK-SAFE: Processing audio data: ${Math.round(audioData.length / 1024)}KB`);
  
  // Step 1: Check collection first
  try {
    sourcesChecked.push('Collection');
    console.log('🏆 Checking collection...');
    const collectionResult = await checkCollectionSafe(audioData);
    if (collectionResult) {
      results.push(collectionResult);
      console.log('🏆 Collection match found, continuing for alternatives...');
    }
  } catch (error) {
    console.error('❌ Collection check failed:', error);
  }
  
  logMemoryUsage('After Collection Check');
  
  // Step 2: Check external services
  const externalChecks: Array<Promise<RecognitionMatch | null>> = [];
  
  if (process.env.ACRCLOUD_ACCESS_KEY) {
    sourcesChecked.push('ACRCloud');
    externalChecks.push(checkACRCloudSafe(audioData));
  }
  
  if (process.env.AUDD_API_TOKEN) {
    sourcesChecked.push('AudD');
    externalChecks.push(checkAudDSafe(audioData));
  }
  
  // Run external checks with proper error isolation
  if (externalChecks.length > 0) {
    console.log(`🌐 STACK-SAFE: Checking ${externalChecks.length} external services...`);
    
    const externalResults = await Promise.allSettled(externalChecks);
    
    externalResults.forEach((checkResult, index) => {
      const serviceName = index === 0 ? 'ACRCloud' : 'AudD';
      
      if (checkResult.status === 'fulfilled' && checkResult.value) {
        results.push(checkResult.value);
        console.log(`✅ ${serviceName}: Match found`);
      } else if (checkResult.status === 'rejected') {
        console.error(`❌ ${serviceName}: ${checkResult.reason}`);
      } else {
        console.log(`⚪ ${serviceName}: No match`);
      }
    });
  }
  
  logMemoryUsage('After External Checks');
  
  console.log(`📊 STACK-SAFE: Recognition complete: ${results.length} matches from ${sourcesChecked.length} sources`);
  
  if (results.length === 0) {
    throw new Error('No matches found from any source');
  }
  
  // Auto-select the best result
  const autoSelected = selectBestResultSafe(results);
  
  // Generate alternatives
  const alternatives = results
    .filter(r => r !== autoSelected)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
  
  logMemoryUsage('Multi-Source Complete');
  
  return {
    autoSelected,
    alternatives,
    allResults: results,
    processingTime: Date.now() - startTime,
    sourcesChecked
  };
}

// GET - Return enhanced service status
export async function GET() {
  const enabledServices = [];
  
  if (process.env.ACRCLOUD_ACCESS_KEY) enabledServices.push('ACRCloud');
  if (process.env.AUDD_API_TOKEN) enabledServices.push('AudD');
  if (process.env.SPOTIFY_CLIENT_ID) enabledServices.push('Spotify Web API');
  
  return NextResponse.json({
    success: true,
    message: "STACK-SAFE Real Audio Recognition API",
    mode: "production_stack_safe_audio",
    features: [
      "stack_overflow_prevention",
      "memory_efficient_processing", 
      "enhanced_error_handling",
      "size_validation",
      "timeout_protection",
      "spotify_metadata_enhancement",
      "collection_priority_matching",
      "parallel_processing",
      "confidence_scoring"
    ],
    enabledServices: ['Collection Database', ...enabledServices],
    totalSources: enabledServices.length + 1,
    audioLimits: {
      maxBase64Size: `${Math.round(AUDIO_LIMITS.MAX_BASE64_SIZE / 1024 / 1024)}MB`,
      maxBufferSize: `${Math.round(AUDIO_LIMITS.MAX_BUFFER_SIZE / 1024 / 1024)}MB`,
      timeoutMs: AUDIO_LIMITS.TIMEOUT_MS
    },
    improvements: [
      "Stack overflow prevention for large files",
      "Memory usage monitoring",
      "Enhanced buffer validation",
      "Timeout protection on all requests",
      "Better error categorization",
      "Safe parallel processing"
    ],
    version: "4.0.1-error-free"
  });
}

// POST - Process real audio recognition with STACK-SAFE handling
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 STACK-SAFE Recognition API called');
  logMemoryUsage('Request Start');
  
  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 Processing STACK-SAFE recognition (${triggeredBy})`);
    console.log(`Audio data size: ${Math.round(audioData.length / 1024)}KB`);
    
    // Enhanced size validation
    if (audioData.length > AUDIO_LIMITS.MAX_BASE64_SIZE) {
      const sizeMB = Math.round(audioData.length / 1024 / 1024);
      const maxMB = Math.round(AUDIO_LIMITS.MAX_BASE64_SIZE / 1024 / 1024);
      return NextResponse.json({
        success: false,
        error: `Audio data too large: ${sizeMB}MB (max ${maxMB}MB)`,
        processingTime: Date.now() - startTime,
        sourcesChecked: [],
        details: "Try recording for a shorter duration or check microphone settings"
      }, { status: 413 });
    }
    
    // Perform stack-safe multi-source recognition
    const recognition = await performMultiSourceRecognitionSafe(audioData);
    
    logMemoryUsage('After Recognition');
    
    // Log successful recognition
    const { data: logData, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
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
          ...recognition,
          triggered_by: triggeredBy, 
          processing_time: recognition.processingTime,
          mode: 'stack_safe_v4_fixed',
          spotify_enhanced: !!recognition.autoSelected.spotify_id,
          audio_size_kb: Math.round(audioData.length / 1024)
        },
        created_at: new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to log recognition:', logError);
    }
    
    // Update now_playing
    const nowPlayingData = {
      id: 1,
      artist: recognition.autoSelected.artist,
      title: recognition.autoSelected.title,
      album_title: recognition.autoSelected.album,
      album_id: recognition.autoSelected.albumId || null,
      recognition_image_url: recognition.autoSelected.image_url,
      started_at: new Date().toISOString(),
      recognition_confidence: recognition.autoSelected.confidence,
      service_used: recognition.autoSelected.service,
      next_recognition_in: recognition.autoSelected.source === 'collection' ? 20 : 30,
      track_duration: recognition.autoSelected.duration_ms ? Math.floor(recognition.autoSelected.duration_ms / 1000) : null,
      updated_at: new Date().toISOString()
    };

    const { error: nowPlayingError } = await supabase
      .from('now_playing')
      .upsert(nowPlayingData);
    
    if (nowPlayingError) {
      console.error('Failed to update now playing:', nowPlayingError);
    } else {
      console.log('✅ Now playing updated with STACK-SAFE data');
      
      // Send broadcast for real-time updates
      try {
        await supabase.channel('now_playing_updates').send({
          type: 'broadcast',
          event: 'force_refresh',
          payload: { updated_at: nowPlayingData.updated_at }
        });
      } catch (broadcastError) {
        console.log('⚠️ Broadcast failed:', broadcastError);
      }
    }
    
    // Set album context
    try {
      await supabase.from('album_context').delete().neq('id', 0);
      await supabase.from('album_context').insert({
        artist: recognition.autoSelected.artist,
        title: recognition.autoSelected.album,
        album: recognition.autoSelected.album,
        year: new Date().getFullYear().toString(),
        collection_id: recognition.autoSelected.albumId || null,
        source: `stack_safe_${recognition.autoSelected.source}`,
        created_at: new Date().toISOString()
      });
    } catch (contextError) {
      console.log('⚠️ Album context update failed:', contextError);
    }
    
    const totalProcessingTime = Date.now() - startTime;
    logMemoryUsage('Request Complete');
    
    return NextResponse.json({
      success: true,
      autoSelected: recognition.autoSelected,
      alternatives: recognition.alternatives,
      allResults: recognition.allResults,
      processingTime: totalProcessingTime,
      sourcesChecked: recognition.sourcesChecked,
      logId: logData?.id,
      triggeredBy,
      message: `STACK-SAFE: ${recognition.autoSelected.artist} - ${recognition.autoSelected.title} (${recognition.autoSelected.source})`,
      stats: {
        totalMatches: recognition.allResults.length,
        collectionMatches: recognition.allResults.filter(r => r.source === 'collection').length,
        externalMatches: recognition.allResults.filter(r => r.source !== 'collection').length,
        autoSelectedSource: recognition.autoSelected.source,
        autoSelectedConfidence: recognition.autoSelected.confidence,
        spotifyEnhanced: !!recognition.autoSelected.spotify_id,
        realAudioProcessing: true,
        audioDataSizeKB: Math.round(audioData.length / 1024),
        stackSafe: true,
        memoryEfficient: true
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ STACK-SAFE Recognition API error:', error);
    logMemoryUsage('Request Error');
    
    // Enhanced error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let errorCategory = 'unknown';
    let statusCode = 500;
    
    if (errorMessage.includes('too large') || errorMessage.includes('size')) {
      errorCategory = 'size_limit';
      statusCode = 413;
    } else if (errorMessage.includes('timeout')) {
      errorCategory = 'timeout';
      statusCode = 408;
    } else if (errorMessage.includes('memory') || errorMessage.includes('stack')) {
      errorCategory = 'memory_protection';
      statusCode = 507;
    } else if (errorMessage.includes('base64') || errorMessage.includes('encoding')) {
      errorCategory = 'encoding_error';
      statusCode = 400;
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      processingTime,
      details: "STACK-SAFE multi-source recognition failed",
      errorCategory,
      mode: 'stack_safe_v4_error_free',
      suggestions: errorCategory === 'size_limit' ? 
        ['Try recording for a shorter duration', 'Check microphone settings', 'Reduce audio quality if possible'] :
        errorCategory === 'timeout' ? 
        ['Audio processing took too long', 'Try with a shorter recording', 'Check network connection'] :
        ['Please try again', 'Check microphone permissions']
    }, { status: statusCode });
  }
}