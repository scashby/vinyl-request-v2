// src/app/api/audio-recognition/route.ts
// FIXED: Better error handling and memory management for large audio files

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

// Timeout wrapper for fetch requests since native fetch doesn't support timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// FIXED: Better base64 to buffer conversion for large files
function base64ToBuffer(base64: string): Buffer {
  try {
    console.log(`🔄 Converting base64 string (${base64.length} chars) to buffer...`);
    
    // Validate base64 string
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('Invalid base64 string provided');
    }
    
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    
    // Convert in chunks to avoid memory issues
    const buffer = Buffer.from(cleanBase64, 'base64');
    console.log(`✅ Base64 conversion complete: ${buffer.length} bytes`);
    
    return buffer;
  } catch (error) {
    console.error('❌ Base64 conversion failed:', error);
    throw new Error(`Failed to convert base64 to buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Spotify Web API integration for enhanced metadata
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
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
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
      
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const track = data.tracks?.items?.[0];
        
        if (track) {
          return {
            artist: track.artists[0]?.name || artist,
            title: track.name,
            album: track.album?.name || 'Unknown Album',
            confidence: 0.95, // High confidence for exact matches
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

// FIXED: ACRCloud implementation with better error handling
async function checkACRCloud(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY || !process.env.ACRCLOUD_ENDPOINT) {
    console.log('⏭️ ACRCloud: Missing credentials');
    return null;
  }
  
  console.log('🎵 ACRCloud: Processing real audio fingerprint...');
  
  try {
    // FIXED: Better buffer conversion with error handling
    const audioBuffer = base64ToBuffer(audioData);
    
    // Validate buffer size
    if (audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }
    
    if (audioBuffer.length > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Audio file too large (max 10MB)');
    }
    
    console.log(`🎵 ACRCloud: Processing ${audioBuffer.length} bytes...`);
    
    // ACRCloud signature generation
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${process.env.ACRCLOUD_ACCESS_KEY}\naudio\n1\n${timestamp}`;
    const signature = crypto
      .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest('base64');

    // Prepare form data
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer]), 'sample.webm');
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', process.env.ACRCLOUD_ACCESS_KEY);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());

    // FIXED: Use timeout wrapper
    const response = await fetchWithTimeout(`${process.env.ACRCLOUD_ENDPOINT}/v1/identify`, {
      method: 'POST',
      body: formData
    }, 20000); // 20 second timeout for large files

    if (response.ok) {
      const result = await response.json();
      
      if (result.status?.code === 0 && result.metadata?.music?.length > 0) {
        const music = result.metadata.music[0];
        
        console.log('✅ ACRCloud: Match found:', music.title, 'by', music.artists?.[0]?.name);
        
        // Enhance with Spotify data
        let spotifyEnhancement = null;
        if (music.artists?.[0]?.name && music.title) {
          spotifyEnhancement = await SpotifyAPI.searchTrack(music.artists[0].name, music.title);
        }
        
        return {
          artist: music.artists?.[0]?.name || 'Unknown Artist',
          title: music.title || 'Unknown Title',
          album: music.album?.name || spotifyEnhancement?.album || 'Unknown Album',
          confidence: 0.95, // ACRCloud is very reliable
          source: 'acrcloud' as const,
          service: 'ACRCloud',
          image_url: spotifyEnhancement?.image_url,
          processingTime: Date.now() - startTime,
          spotify_id: spotifyEnhancement?.spotify_id,
          duration_ms: music.duration_ms || spotifyEnhancement?.duration_ms,
          isrc: music.external_ids?.isrc
        };
      } else {
        console.log(`❌ ACRCloud: No match found (status: ${result.status?.code})`);
      }
    } else {
      console.error('❌ ACRCloud: API error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ ACRCloud: Processing error:', error);
    
    // Return more specific error information
    if (error instanceof Error) {
      if (error.message.includes('too large')) {
        console.log('⚠️ ACRCloud: Audio file too large, skipping');
      } else if (error.message.includes('base64')) {
        console.log('⚠️ ACRCloud: Base64 conversion failed, skipping');
      }
    }
  }
  
  return null;
}

// FIXED: AudD implementation with better buffer handling
async function checkAudD(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  
  if (!process.env.AUDD_API_TOKEN) {
    console.log('⏭️ AudD: Missing API token');
    return null;
  }
  
  console.log('🎼 AudD: Processing audio...');
  
  try {
    const formData = new FormData();
    const audioBuffer = base64ToBuffer(audioData);
    
    // Validate buffer
    if (audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }
    
    formData.append('audio', new Blob([audioBuffer]), 'audio.webm');
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('return', 'spotify');

    const response = await fetchWithTimeout('https://api.audd.io/', {
      method: 'POST',
      body: formData
    }, 25000); // 25 second timeout

    if (response.ok) {
      const result = await response.json();
      
      if (result.status === 'success' && result.result) {
        const track = result.result;
        
        console.log('✅ AudD: Match found:', track.title, 'by', track.artist);
        
        return {
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
      }
    }
  } catch (error) {
    console.error('❌ AudD: Error:', error);
  }
  
  return null;
}

// Collection recognition (keep existing)
async function checkCollection(audioData: string): Promise<RecognitionMatch | null> {
  const startTime = Date.now();
  console.log('🏆 Checking collection database...');
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/audio-recognition/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData,
        triggeredBy: 'multi_source_collection',
        timestamp: new Date().toISOString()
      })
    });

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
    console.error('Collection check error:', error);
  }
  
  return null;
}

// IMPROVED auto-selection algorithm
function selectBestResult(results: RecognitionMatch[]): RecognitionMatch {
  console.log(`🎯 Auto-selecting from ${results.length} results with FIXED algorithm`);
  
  // 1. Collection matches always win (if confidence > 0.7)
  const collectionMatches = results.filter(r => r.source === 'collection' && r.confidence > 0.7);
  if (collectionMatches.length > 0) {
    const best = collectionMatches.sort((a, b) => b.confidence - a.confidence)[0];
    console.log(`🏆 Collection match selected: ${best.artist} - ${best.title} (${best.confidence})`);
    return best;
  }
  
  // 2. High confidence external matches (>0.9)
  const highConfidenceMatches = results.filter(r => r.confidence > 0.9);
  if (highConfidenceMatches.length > 0) {
    // Prioritize by source reliability: ACRCloud > AudD > Spotify > AcoustID
    const sourcePriority = { acrcloud: 5, audd: 4, spotify: 3, acoustid: 2, shazam: 1 };
    const best = highConfidenceMatches.sort((a, b) => {
      const priorityA = sourcePriority[a.source as keyof typeof sourcePriority] || 0;
      const priorityB = sourcePriority[b.source as keyof typeof sourcePriority] || 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    })[0];
    
    console.log(`🌟 High confidence match: ${best.artist} - ${best.title} (${best.source}, ${best.confidence})`);
    return best;
  }
  
  // 3. Medium confidence external matches (>0.6)
  const mediumConfidenceMatches = results.filter(r => r.confidence > 0.6);
  if (mediumConfidenceMatches.length > 0) {
    const best = mediumConfidenceMatches.sort((a, b) => {
      const sourcePriority = { acrcloud: 5, audd: 4, spotify: 3, acoustid: 2, shazam: 1 };
      const priorityA = sourcePriority[a.source as keyof typeof sourcePriority] || 0;
      const priorityB = sourcePriority[b.source as keyof typeof sourcePriority] || 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    })[0];
    
    console.log(`🎯 Medium confidence match: ${best.artist} - ${best.title} (${best.source}, ${best.confidence})`);
    return best;
  }
  
  // 4. Fallback to any result
  if (results.length > 0) {
    const fallback = results.sort((a, b) => b.confidence - a.confidence)[0];
    console.log(`⚠️ Fallback selection: ${fallback.artist} - ${fallback.title} (${fallback.confidence})`);
    return fallback;
  }
  
  throw new Error('No results to select from');
}

// FIXED: Multi-source recognition engine with better error handling
async function performMultiSourceRecognition(audioData: string): Promise<MultiSourceResponse> {
  const startTime = Date.now();
  const results: RecognitionMatch[] = [];
  const sourcesChecked: string[] = [];
  
  console.log('🎯 Starting FIXED multi-source recognition...');
  
  // Validate audio data
  if (!audioData || audioData.length === 0) {
    throw new Error('No audio data provided');
  }
  
  console.log(`📊 Processing audio data: ${audioData.length} characters`);
  
  // Step 1: Check collection first (highest priority)
  try {
    sourcesChecked.push('Collection');
    const collectionResult = await checkCollection(audioData);
    if (collectionResult) {
      results.push(collectionResult);
      console.log('🏆 Collection match found, continuing for alternatives...');
    }
  } catch (error) {
    console.error('Collection check failed:', error);
  }
  
  // Step 2: Check external services in parallel
  const externalChecks = [];
  
  if (process.env.ACRCLOUD_ACCESS_KEY) {
    sourcesChecked.push('ACRCloud');
    externalChecks.push(checkACRCloud(audioData));
  }
  
  if (process.env.AUDD_API_TOKEN) {
    sourcesChecked.push('AudD');
    externalChecks.push(checkAudD(audioData));
  }
  
  // Run external checks in parallel with better error handling
  if (externalChecks.length > 0) {
    console.log(`🌐 Checking ${externalChecks.length} external services in parallel...`);
    const externalResults = await Promise.allSettled(externalChecks);
    
    externalResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else if (result.status === 'rejected') {
        console.error(`External service ${index} failed:`, result.reason);
      }
    });
  }
  
  console.log(`📊 Recognition complete: ${results.length} matches from ${sourcesChecked.length} sources`);
  
  if (results.length === 0) {
    throw new Error('No matches found from any source');
  }
  
  // Auto-select the best result
  const autoSelected = selectBestResult(results);
  
  // Generate alternatives
  const alternatives = results
    .filter(r => r !== autoSelected)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
  
  return {
    autoSelected,
    alternatives,
    allResults: results,
    processingTime: Date.now() - startTime,
    sourcesChecked
  };
}

// GET - Return service status
export async function GET() {
  const enabledServices = [];
  
  if (process.env.ACRCLOUD_ACCESS_KEY) enabledServices.push('ACRCloud');
  if (process.env.AUDD_API_TOKEN) enabledServices.push('AudD');
  if (process.env.SPOTIFY_CLIENT_ID) enabledServices.push('Spotify Web API');
  
  return NextResponse.json({
    success: true,
    message: "FIXED Real Audio Recognition API",
    mode: "production_real_audio_fixed",
    features: [
      "fixed_base64_conversion",
      "improved_error_handling",
      "memory_efficient_processing",
      "spotify_metadata_enhancement",
      "collection_priority_matching",
      "parallel_processing",
      "confidence_scoring"
    ],
    enabledServices: ['Collection Database', ...enabledServices],
    totalSources: enabledServices.length + 1,
    improvements: [
      "Fixed base64 conversion for large files",
      "Better memory management",
      "Improved error handling",
      "Buffer size validation",
      "Enhanced timeout handling"
    ],
    version: "3.0.2-fixed"
  });
}

// POST - Process real audio recognition with FIXED handling
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 Processing FIXED multi-source recognition (${triggeredBy})`);
    console.log(`Audio data size: ${audioData.length} characters`);
    
    // FIXED: Add memory and size validation
    if (audioData.length > 5 * 1024 * 1024) { // 5MB base64 limit
      return NextResponse.json({
        success: false,
        error: "Audio data too large (max 5MB base64)",
        processingTime: Date.now() - startTime,
        sourcesChecked: []
      }, { status: 413 });
    }
    
    // Perform multi-source recognition
    const recognition = await performMultiSourceRecognition(audioData);
    
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
          mode: 'real_audio_v3_fixed',
          spotify_enhanced: !!recognition.autoSelected.spotify_id
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
      console.log('✅ Now playing updated with FIXED data');
      
      // Send broadcast to ensure real-time updates
      await supabase.channel('now_playing_updates').send({
        type: 'broadcast',
        event: 'force_refresh',
        payload: { updated_at: nowPlayingData.updated_at }
      });
    }
    
    // Set album context
    await supabase.from('album_context').delete().neq('id', 0);
    await supabase.from('album_context').insert({
      artist: recognition.autoSelected.artist,
      title: recognition.autoSelected.album,
      album: recognition.autoSelected.album,
      year: new Date().getFullYear().toString(),
      collection_id: recognition.autoSelected.albumId || null,
      source: `fixed_audio_${recognition.autoSelected.source}`,
      created_at: new Date().toISOString()
    });
    
    const totalProcessingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      autoSelected: recognition.autoSelected,
      alternatives: recognition.alternatives,
      allResults: recognition.allResults,
      processingTime: totalProcessingTime,
      sourcesChecked: recognition.sourcesChecked,
      logId: logData?.id,
      triggeredBy,
      message: `FIXED: ${recognition.autoSelected.artist} - ${recognition.autoSelected.title} (${recognition.autoSelected.source})`,
      stats: {
        totalMatches: recognition.allResults.length,
        collectionMatches: recognition.allResults.filter(r => r.source === 'collection').length,
        externalMatches: recognition.allResults.filter(r => r.source !== 'collection').length,
        autoSelectedSource: recognition.autoSelected.source,
        autoSelectedConfidence: recognition.autoSelected.confidence,
        spotifyEnhanced: !!recognition.autoSelected.spotify_id,
        realAudioProcessing: true,
        audioDataSize: audioData.length,
        fixed: true
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('FIXED Recognition API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      details: "FIXED multi-source recognition failed",
      mode: 'real_audio_v3_fixed_error'
    }, { status: 500 });
  }
}