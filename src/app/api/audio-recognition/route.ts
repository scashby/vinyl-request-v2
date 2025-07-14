// File: src/app/api/audio-recognition/route.ts
// FIXED VERSION - Addresses all reported issues
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import crypto from 'crypto';

interface RecognitionTrack {
  artist: string;
  title: string;
  album?: string;
  image_url?: string;
  confidence?: number;
  service?: string;
  duration?: number;
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  year: string;
  image_url?: string;
  folder?: string;
  priority?: number;
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
  source_priority?: number;
  next_recognition_delay?: number;
}

interface EnhancedRecognitionResult {
  success: boolean;
  track?: EnhancedRecognitionTrack;
  candidates?: EnhancedRecognitionTrack[];
  error?: string;
  servicesQueried?: string[];
  totalCandidatesFound?: number;
  smart_timing?: {
    track_duration?: number;
    next_sample_in?: number;
    reasoning?: string;
  };
  is_silence?: boolean;
  confidence_threshold?: number;
}

// ACRCloud types
interface ACRCloudTrack {
  title?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  duration_ms?: number;
  external_metadata?: {
    spotify?: { 
      album?: { images?: Array<{ url?: string }> };
      duration_ms?: number;
    };
    apple_music?: { album?: { artwork?: { url?: string } } };
    deezer?: { 
      album?: { cover_big?: string };
      duration?: number;
    };
    youtube?: { thumbnail?: string };
  };
}

interface ACRCloudResponse {
  status?: { code?: number; msg?: string; score?: number };
  metadata?: { music?: ACRCloudTrack[] };
}

// Configuration for confidence thresholds and timing
const DEFAULT_CONFIDENCE_THRESHOLD = 0.45; // 45% minimum confidence
const SILENCE_THRESHOLD = 0.30; // Below 30% confidence considered silence
const DEFAULT_SILENCE_INTERVAL = 30; // Check every 30s during silence
const MIN_TRACK_DURATION = 60; // Minimum track duration to use smart timing

// Enhanced collection matching with STRICT PRIORITY
async function findBYOCollectionMatches(artist: string, title: string, album?: string): Promise<CollectionMatch[]> {
  try {
    console.log(`🎯 PRIORITY COLLECTION SEARCH: ${artist} - ${title}${album ? ` (${album})` : ''}`);
    
    const folderPriority: Record<string, number> = {
      'Vinyl': 1,
      'Cassettes': 2, 
      '45s': 3
    };
    
    const byoFolders = ['Vinyl', 'Cassettes', '45s'];
    
    // 1. EXACT artist match in BYO folders ONLY
    const { data: exactMatches } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('artist', artist)
      .in('folder', byoFolders)
      .limit(20);
    
    // 2. Album search if available
    let albumMatches: CollectionMatch[] = [];
    if (album) {
      const { data: albumSearch } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('title', `%${album}%`)
        .in('folder', byoFolders)
        .limit(10);
      
      if (albumSearch) albumMatches = albumSearch;
    }
    
    // 3. Fuzzy artist search
    const artistWords = artist.toLowerCase().split(' ').filter(word => word.length > 2);
    let fuzzyMatches: CollectionMatch[] = [];
    for (const word of artistWords.slice(0, 2)) {
      const { data: fuzzySearch } = await supabase
        .from('collection')
        .select('id, artist, title, year, image_url, folder')
        .ilike('artist', `%${word}%`)
        .in('folder', byoFolders)
        .limit(5);
      
      if (fuzzySearch) fuzzyMatches = fuzzyMatches.concat(fuzzySearch);
    }
    
    // Combine and prioritize
    const allMatches = [...(exactMatches || []), ...albumMatches, ...fuzzyMatches];
    
    const uniqueMatches = allMatches
      .filter((match, index, self) => index === self.findIndex(m => m.id === match.id))
      .map(match => ({
        ...match,
        priority: folderPriority[match.folder || ''] || 999
      }))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        const aArtistMatch = a.artist.toLowerCase().includes(artist.toLowerCase()) ? 1 : 0;
        const bArtistMatch = b.artist.toLowerCase().includes(artist.toLowerCase()) ? 1 : 0;
        return bArtistMatch - aArtistMatch;
      })
      .slice(0, 10);
    
    console.log(`✅ Found ${uniqueMatches.length} BYO collection matches`);
    return uniqueMatches;
    
  } catch (error) {
    console.error('BYO Collection matching error:', error);
    return [];
  }
}

// Extract track duration from various sources
function extractTrackDuration(track: ACRCloudTrack): number | undefined {
  if (track.duration_ms) return Math.round(track.duration_ms / 1000);
  if (track.external_metadata?.spotify?.duration_ms) return Math.round(track.external_metadata.spotify.duration_ms / 1000);
  if (track.external_metadata?.deezer?.duration) return track.external_metadata.deezer.duration;
  return undefined;
}

// FIXED: Smart timing calculation that properly resets
function calculateSmartTiming(
  trackDuration?: number, 
  isNewTrack: boolean = true
): {
  next_sample_in: number;
  reasoning: string;
} {
  // If no duration or track too short, use default interval
  if (!trackDuration || trackDuration < MIN_TRACK_DURATION) {
    return {
      next_sample_in: DEFAULT_SILENCE_INTERVAL,
      reasoning: trackDuration ? 
        `Short track (${trackDuration}s) - using default ${DEFAULT_SILENCE_INTERVAL}s interval` :
        `No duration info - using default ${DEFAULT_SILENCE_INTERVAL}s interval`
    };
  }
  
  // For new tracks, start smart timing fresh
  if (isNewTrack) {
    // Sample again at 70% through the track, but at least 45 seconds from now
    const smartDelay = Math.max(45, Math.round(trackDuration * 0.7));
    return {
      next_sample_in: Math.min(smartDelay, 300), // Cap at 5 minutes
      reasoning: `NEW TRACK: ${trackDuration}s long - next sample in ${smartDelay}s (70% through track)`
    };
  }
  
  // For continued recognition of same track, use shorter intervals
  const remainingTime = trackDuration - (trackDuration * 0.3); // Assume we're 30% through
  const smartDelay = Math.max(30, Math.round(remainingTime * 0.5));
  
  return {
    next_sample_in: Math.min(smartDelay, 180), // Cap at 3 minutes for continued recognition
    reasoning: `CONTINUING TRACK: ${trackDuration}s - next sample in ${smartDelay}s (50% of remaining time)`
  };
}

// FIXED: Enhanced ACRCloud recognition returning ALL candidates above threshold
async function recognizeWithACRCloud(audioFile: File, confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY) {
    console.log('ACRCloud: Missing API credentials');
    return [];
  }

  try {
    console.log(`🔊 ACRCloud: Starting recognition with ${confidenceThreshold * 100}% confidence threshold...`);
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    // Check for silence by analyzing audio buffer
    const isLikelySilence = analyzeAudioForSilence(audioBuffer);
    if (isLikelySilence) {
      console.log('🔇 Audio appears to be silence, skipping ACRCloud');
      return [];
    }
    
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
    
    const formData = new FormData();
    formData.append('sample', new Blob([audioBuffer], { type: 'audio/wav' }));
    formData.append('sample_bytes', audioBuffer.length.toString());
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${endpoint}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) {
      console.warn(`ACRCloud HTTP error: ${response.status}`);
      return [];
    }

    const data: ACRCloudResponse = await response.json();
    
    if (data.status?.code === 0 && data.metadata?.music) {
      console.log(`✅ ACRCloud: Found ${data.metadata.music.length} total results`);
      
      // FIXED: Return ALL results above confidence threshold, not just top 5
      const results = data.metadata.music
        .map((track, index): EnhancedRecognitionTrack => {
          const baseConfidence = (data.status?.score || 80) / 100;
          const adjustedConfidence = Math.max(0.3, baseConfidence - (index * 0.02)); // Slight degradation per result
          
          const extractImageUrl = (track: ACRCloudTrack): string | undefined => {
            return track.external_metadata?.spotify?.album?.images?.[0]?.url ||
                   track.external_metadata?.apple_music?.album?.artwork?.url ||
                   track.external_metadata?.deezer?.album?.cover_big;
          };

          const duration = extractTrackDuration(track);

          return {
            artist: track.artists?.[0]?.name || 'Unknown Artist',
            title: track.title || 'Unknown Title',
            album: track.album?.name,
            image_url: extractImageUrl(track),
            confidence: adjustedConfidence,
            service: 'ACRCloud',
            source_priority: 1,
            is_guest_vinyl: true,
            duration: duration
          };
        })
        .filter(track => (track.confidence || 0) >= confidenceThreshold); // Filter by threshold
      
      console.log(`🎯 ACRCloud: ${results.length} results above ${confidenceThreshold * 100}% confidence`);
      return results;
    } else {
      console.log(`❌ ACRCloud: No results. Status code: ${data.status?.code}`);
    }
    
    return [];
  } catch (error) {
    console.error('ACRCloud error:', error);
    return [];
  }
}

// Enhanced AudD recognition with confidence filtering
async function recognizeWithAudD(audioFile: File, confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.AUDD_API_TOKEN) {
    console.log('AudD: Missing API token');
    return [];
  }

  try {
    console.log(`🔊 AudD: Starting recognition with ${confidenceThreshold * 100}% confidence threshold...`);
    const formData = new FormData();
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify,deezer');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    if (!response.ok) {
      console.warn(`AudD HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status === 'success' && data.result) {
      console.log('✅ AudD: Found result');
      
      // AudD typically returns one main result, but check confidence
      const confidence = 0.8; // AudD doesn't provide confidence scores, assume 80%
      
      if (confidence < confidenceThreshold) {
        console.log(`🎯 AudD: Result below ${confidenceThreshold * 100}% confidence threshold`);
        return [];
      }
      
      let imageUrl: string | undefined;
      let duration: number | undefined;
      
      if (data.result.spotify?.album?.images?.length > 0) {
        imageUrl = data.result.spotify.album.images[0].url;
      } else if (data.result.apple_music?.artwork?.url) {
        imageUrl = data.result.apple_music.artwork.url;
      } else if (data.result.deezer?.album?.cover_big) {
        imageUrl = data.result.deezer.album.cover_big;
      }

      if (data.result.spotify?.duration_ms) {
        duration = Math.round(data.result.spotify.duration_ms / 1000);
      } else if (data.result.deezer?.duration) {
        duration = data.result.deezer.duration;
      }
      
      return [{
        artist: data.result.artist || 'Unknown Artist',
        title: data.result.title || 'Unknown Title',
        album: data.result.album,
        image_url: imageUrl,
        confidence: confidence,
        service: 'AudD',
        source_priority: 2,
        is_guest_vinyl: true,
        duration: duration
      }];
    } else {
      console.log(`❌ AudD: No results. Status: ${data.status}`);
    }
    
    return [];
  } catch (error) {
    console.error('AudD error:', error);
    return [];
  }
}

// Simple silence detection based on audio buffer analysis
function analyzeAudioForSilence(audioBuffer: Buffer): boolean {
  try {
    // Simple silence detection - check if audio data is very quiet
    if (audioBuffer.length < 1000) return true;
    
    // Sample some bytes and check for very low values (indicating silence)
    const sampleSize = Math.min(1000, audioBuffer.length);
    let totalValue = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      totalValue += Math.abs(audioBuffer[i] - 128); // 128 is mid-range for 8-bit audio
    }
    
    const averageValue = totalValue / sampleSize;
    const isQuiet = averageValue < 10; // Very low threshold for "silence"
    
    if (isQuiet) {
      console.log(`🔇 Silence detected: average audio level ${averageValue.toFixed(2)}`);
    }
    
    return isQuiet;
  } catch (error) {
    console.error('Error analyzing audio for silence:', error);
    return false;
  }
}

// Get current album context to check if this is a continuing track
async function getCurrentAlbumContext(): Promise<{
  artist?: string;
  title?: string;
  track_listing?: string[];
} | null> {
  try {
    const { data } = await supabase
      .from('album_context')
      .select('artist, title, track_listing')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data || null;
  } catch {
    return null;
  }
}

// Check if this is the same track as last recognition
async function getLastRecognition(): Promise<{
  artist?: string;
  title?: string;
  started_at?: string;
} | null> {
  try {
    const { data } = await supabase
      .from('now_playing')
      .select('artist, title, started_at')
      .eq('id', 1)
      .single();
    
    return data || null;
  } catch {
    return null;
  }
}

function isSameTrack(track1: { artist?: string; title?: string }, track2: { artist?: string; title?: string }): boolean {
  if (!track1.artist || !track1.title || !track2.artist || !track2.title) return false;
  
  const normalize = (str: string) => str.toLowerCase().trim();
  return normalize(track1.artist) === normalize(track2.artist) && 
         normalize(track1.title) === normalize(track2.title);
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

// MAIN POST HANDLER - FIXED VERSION
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const confidenceThresholdParam = formData.get('confidence_threshold') as string | null;
    
    // Parse confidence threshold or use default
    const confidenceThreshold = confidenceThresholdParam ? 
      Math.max(0.1, Math.min(1.0, parseFloat(confidenceThresholdParam))) : 
      DEFAULT_CONFIDENCE_THRESHOLD;

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or empty audio file' },
        { status: 400 }
      );
    }

    console.log(`🎵 AUDIO RECOGNITION: ${audioFile.name}, size: ${audioFile.size} bytes, confidence: ${confidenceThreshold * 100}%`);

    // Get current context for smart timing decisions
    const lastRecognition = await getLastRecognition();

    // PHASE 1: Audio Recognition Services (run in parallel)
    console.log('🔊 Phase 1: Audio recognition services...');
    const audioRecognitionPromises = [
      recognizeWithACRCloud(audioFile, confidenceThreshold),
      recognizeWithAudD(audioFile, confidenceThreshold)
    ];

    const audioResults = await Promise.allSettled(audioRecognitionPromises);
    const allAudioCandidates: EnhancedRecognitionTrack[] = [];
    
    audioResults.forEach((result, index) => {
      const serviceName = ['ACRCloud', 'AudD'][index];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${serviceName}: Found ${result.value.length} candidates above threshold`);
        allAudioCandidates.push(...result.value);
      } else {
        console.log(`❌ ${serviceName}: No results above confidence threshold`);
      }
    });

    console.log(`📊 Total external candidates found: ${allAudioCandidates.length}`);

    // SILENCE DETECTION - Check if no results or all very low confidence
    const highestConfidence = Math.max(...allAudioCandidates.map(c => c.confidence || 0), 0);
    const isSilence = allAudioCandidates.length === 0 || highestConfidence < SILENCE_THRESHOLD;

    if (isSilence) {
      console.log(`🔇 SILENCE DETECTED - highest confidence: ${(highestConfidence * 100).toFixed(1)}%`);
      
      // Clear now playing if silence detected
      await supabase
        .from('now_playing')
        .update({
          artist: null,
          title: null,
          album_title: null,
          recognition_image_url: null,
          album_id: null,
          updated_at: new Date().toISOString(),
          track_duration: null,
          next_recognition_in: DEFAULT_SILENCE_INTERVAL
        })
        .eq('id', 1);

      return NextResponse.json({
        success: true,
        is_silence: true,
        confidence_threshold: confidenceThreshold,
        servicesQueried: ['ACRCloud', 'AudD'],
        totalCandidatesFound: allAudioCandidates.length,
        smart_timing: {
          next_sample_in: DEFAULT_SILENCE_INTERVAL,
          reasoning: `Silence detected (highest confidence: ${(highestConfidence * 100).toFixed(1)}%) - checking again in ${DEFAULT_SILENCE_INTERVAL}s`
        }
      } satisfies EnhancedRecognitionResult);
    }

    // Get the best external recognition
    const bestExternalTrack = allAudioCandidates.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0];

    console.log(`🎯 Best external recognition: ${bestExternalTrack.artist} - ${bestExternalTrack.title} (${(bestExternalTrack.confidence || 0 * 100).toFixed(1)}%)`);

    // PHASE 2: COLLECTION SEARCH
    console.log('🏆 Phase 2: PRIORITY COLLECTION SEARCH...');
    
    const collectionMatches = await findBYOCollectionMatches(
      bestExternalTrack.artist, 
      bestExternalTrack.title, 
      bestExternalTrack.album
    );

    let finalTrack: EnhancedRecognitionTrack;
    let candidates: EnhancedRecognitionTrack[] = [];

    // Collection takes priority
    if (collectionMatches.length > 0) {
      console.log(`🎉 COLLECTION MATCH FOUND!`);
      
      const topCollectionMatch = collectionMatches[0];
      
      finalTrack = {
        artist: topCollectionMatch.artist,
        title: bestExternalTrack.title,
        album: topCollectionMatch.title,
        image_url: topCollectionMatch.image_url || bestExternalTrack.image_url,
        confidence: 0.95,
        service: `Collection Match (${topCollectionMatch.folder})`,
        source_priority: 0,
        collection_match: topCollectionMatch,
        is_guest_vinyl: false,
        duration: bestExternalTrack.duration
      };

      // Add other collection matches as candidates
      candidates = collectionMatches.slice(1).map((match: CollectionMatch): EnhancedRecognitionTrack => ({
        artist: match.artist,
        title: bestExternalTrack.title,
        album: match.title,
        image_url: match.image_url,
        confidence: 0.90,
        service: `Collection Match (${match.folder})`,
        source_priority: 0,
        collection_match: match,
        is_guest_vinyl: false,
        duration: bestExternalTrack.duration
      }));

    } else {
      console.log(`⚠️ NO COLLECTION MATCH - Using external recognition`);
      finalTrack = {
        ...bestExternalTrack,
        is_guest_vinyl: true,
        source_priority: 1
      };
    }

    // Add ALL external candidates (not just one from each service)
    candidates.push(...allAudioCandidates
      .filter(track => track !== bestExternalTrack) // Don't duplicate the primary track
      .map(track => ({
        ...track,
        is_guest_vinyl: true,
        source_priority: 10
      })));

    console.log(`📊 Final result: Primary + ${candidates.length} candidates`);

    // PHASE 3: FIXED Smart Timing Calculation
    console.log('⏰ Phase 3: FIXED Smart timing calculation...');
    
    // Check if this is the same track as before
    const isNewTrack = !lastRecognition || !isSameTrack(finalTrack, lastRecognition);
    const smartTiming = calculateSmartTiming(finalTrack.duration, isNewTrack);
    finalTrack.next_recognition_delay = smartTiming.next_sample_in;
    
    console.log(`🧠 Smart timing: ${smartTiming.reasoning}`);

    // PHASE 4: Database Update
    console.log('💾 Phase 4: Updating database...');
    
    try {
      const updateData = {
        id: 1,
        artist: finalTrack.artist,
        title: finalTrack.title,
        album_title: finalTrack.album,
        recognition_image_url: finalTrack.image_url,
        album_id: finalTrack.collection_match?.id || null,
        started_at: isNewTrack ? new Date().toISOString() : lastRecognition?.started_at,
        recognition_confidence: finalTrack.confidence || 0.8,
        service_used: finalTrack.service || 'Multi-Service',
        updated_at: new Date().toISOString(),
        track_duration: finalTrack.duration || null,
        next_recognition_in: finalTrack.next_recognition_delay || DEFAULT_SILENCE_INTERVAL
      };

      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert(updateData);

      if (nowPlayingError) {
        throw nowPlayingError;
      }

      console.log('✅ Database updated successfully');
      
    } catch (dbError) {
      console.error('❌ Database update error:', dbError);
    }

    console.log(`🎉 Recognition complete! Confidence: ${(finalTrack.confidence || 0 * 100).toFixed(1)}%`);

    return NextResponse.json({
      success: true,
      track: finalTrack,
      candidates: candidates,
      servicesQueried: ['ACRCloud', 'AudD', 'BYO Collection Search (PRIORITY)'],
      totalCandidatesFound: allAudioCandidates.length + collectionMatches.length,
      confidence_threshold: confidenceThreshold,
      is_silence: false,
      smart_timing: {
        track_duration: finalTrack.duration,
        next_sample_in: finalTrack.next_recognition_delay,
        reasoning: smartTiming.reasoning
      }
    } satisfies EnhancedRecognitionResult);

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        servicesQueried: [],
        totalCandidatesFound: 0,
        confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD
      } satisfies EnhancedRecognitionResult,
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ 
    message: 'FIXED Audio Recognition API - Addresses all reported issues',
    version: '5.0.0',
    features: [
      'FIXED: Smart timing now properly resets for new tracks vs continuing tracks',
      'FIXED: Silence detection with automatic clearing of now_playing',
      'FIXED: Returns ALL candidates above confidence threshold, not just one per service',
      'NEW: Adjustable confidence threshold (default 45%)',
      'NEW: Separate silence threshold (30%)',
      'FIXED: Collection priority search restored',
      'FIXED: Proper duration-based smart timing calculations'
    ],
    configuration: {
      default_confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
      silence_threshold: SILENCE_THRESHOLD,
      default_silence_interval: DEFAULT_SILENCE_INTERVAL,
      min_track_duration_for_smart_timing: MIN_TRACK_DURATION
    },
    usage: {
      confidence_threshold: 'Send as form parameter "confidence_threshold" (0.1-1.0)',
      example: 'FormData with audio file + confidence_threshold=0.45'
    }
  });
}