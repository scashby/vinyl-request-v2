// File: src/app/api/audio-recognition/route.ts
// FIXED VERSION with proper error handling and candidate display
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
  duration?: number; // Track duration in seconds
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string; // This is the ALBUM title in the collection
  year: string;
  image_url?: string;
  folder?: string;
  priority?: number; // For sorting: Vinyl=1, Cassettes=2, 45s=3
}

interface EnhancedRecognitionTrack extends RecognitionTrack {
  collection_match?: CollectionMatch;
  is_guest_vinyl?: boolean;
  source_priority?: number;
  next_recognition_delay?: number; // Smart timing for next recognition
}

interface EnhancedRecognitionResult {
  success: boolean;
  track?: EnhancedRecognitionTrack;
  candidates?: EnhancedRecognitionTrack[];
  error?: string;
  albumContextUsed?: boolean;
  albumContextSwitched?: boolean;
  servicesQueried?: string[];
  totalCandidatesFound?: number;
  smart_timing?: {
    track_duration?: number;
    next_sample_in?: number;
    reasoning?: string;
  };
}

// ACRCloud types
interface ACRCloudTrack {
  title?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  duration_ms?: number; // Track duration in milliseconds
  external_metadata?: {
    spotify?: { 
      album?: { images?: Array<{ url?: string }> };
      duration_ms?: number;
    };
    apple_music?: { album?: { artwork?: { url?: string } } };
    deezer?: { 
      album?: { cover_big?: string };
      duration?: number; // Duration in seconds
    };
    youtube?: { thumbnail?: string };
  };
}

interface ACRCloudResponse {
  status?: { code?: number; msg?: string; score?: number };
  metadata?: { music?: ACRCloudTrack[] };
}

// Enhanced collection matching with STRICT PRIORITY for BYO Collection
async function findBYOCollectionMatches(artist: string, title: string, album?: string): Promise<CollectionMatch[]> {
  try {
    console.log(`🎯 PRIORITY COLLECTION SEARCH: ${artist} - ${title}${album ? ` (${album})` : ''}`);
    
    // Define folder priorities: Vinyl=1 (highest), Cassettes=2, 45s=3
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
    
    // 2. If we have album info, also search by album title
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
    
    // 3. Fuzzy artist search for variations
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
    
    // Combine all matches
    const allMatches = [...(exactMatches || []), ...albumMatches, ...fuzzyMatches];
    
    // Remove duplicates and add priority
    const uniqueMatches = allMatches
      .filter((match, index, self) => index === self.findIndex(m => m.id === match.id))
      .map(match => ({
        ...match,
        priority: folderPriority[match.folder || ''] || 999
      }))
      .sort((a, b) => {
        // Sort by folder priority first (Vinyl > Cassettes > 45s)
        if (a.priority !== b.priority) return a.priority - b.priority;
        
        // Then by how well the artist matches
        const aArtistMatch = a.artist.toLowerCase().includes(artist.toLowerCase()) ? 1 : 0;
        const bArtistMatch = b.artist.toLowerCase().includes(artist.toLowerCase()) ? 1 : 0;
        return bArtistMatch - aArtistMatch;
      })
      .slice(0, 10);
    
    console.log(`✅ Found ${uniqueMatches.length} BYO collection matches (prioritized by Vinyl > Cassettes > 45s)`);
    if (uniqueMatches.length > 0) {
      console.log('Top collection matches:', uniqueMatches.slice(0, 3).map(m => `${m.artist} - ${m.title} (${m.folder})`));
    }
    
    return uniqueMatches;
    
  } catch (error) {
    console.error('BYO Collection matching error:', error);
    return [];
  }
}

// Extract track duration from various sources
function extractTrackDuration(track: ACRCloudTrack): number | undefined {
  // Try different duration sources
  if (track.duration_ms) return Math.round(track.duration_ms / 1000);
  if (track.external_metadata?.spotify?.duration_ms) return Math.round(track.external_metadata.spotify.duration_ms / 1000);
  if (track.external_metadata?.deezer?.duration) return track.external_metadata.deezer.duration;
  
  return undefined;
}

// Smart timing calculation
function calculateSmartTiming(trackDuration?: number, currentSampleDuration: number = 15): {
  next_sample_in: number;
  reasoning: string;
} {
  if (!trackDuration) {
    return {
      next_sample_in: 30, // Default fallback
      reasoning: 'No duration info - using default 30s interval'
    };
  }
  
  // If track is very short (< 2 minutes), sample every 30 seconds
  if (trackDuration < 120) {
    return {
      next_sample_in: 30,
      reasoning: `Short track (${trackDuration}s) - frequent sampling every 30s`
    };
  }
  
  // For longer tracks, calculate smart interval
  // Sample again when ~80% through the track, but at least 45 seconds from now
  const timeUntilEnd = trackDuration - currentSampleDuration;
  const smartDelay = Math.max(45, Math.round(timeUntilEnd * 0.8));
  
  return {
    next_sample_in: Math.min(smartDelay, 300), // Cap at 5 minutes
    reasoning: `Track is ${trackDuration}s long - next sample in ${smartDelay}s (80% through track)`
  };
}

// Enhanced ACRCloud recognition with duration extraction
async function recognizeWithACRCloud(audioFile: File): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.ACRCLOUD_ACCESS_KEY || !process.env.ACRCLOUD_SECRET_KEY) {
    console.log('ACRCloud: Missing API credentials');
    return [];
  }

  try {
    console.log('🔊 ACRCloud: Starting recognition...');
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const secretKey = process.env.ACRCLOUD_SECRET_KEY;
    const endpoint = process.env.ACRCLOUD_ENDPOINT || 'identify-us-west-2.acrcloud.com';
    
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`);
    
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

    console.log(`🔊 ACRCloud response status: ${response.status}`);

    if (!response.ok) {
      console.warn(`ACRCloud HTTP error: ${response.status}`);
      return [];
    }

    const data: ACRCloudResponse = await response.json();
    console.log('🔊 ACRCloud response:', JSON.stringify(data, null, 2));
    
    if (data.status?.code === 0 && data.metadata?.music) {
      console.log(`✅ ACRCloud: Found ${data.metadata.music.length} results`);
      return data.metadata.music.slice(0, 5).map((track, index): EnhancedRecognitionTrack => {
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
          confidence: Math.max(0.7, (data.status?.score || 80) / 100 - (index * 0.05)),
          service: 'ACRCloud',
          source_priority: 1,
          is_guest_vinyl: true,
          duration: duration
        };
      });
    } else {
      console.log(`❌ ACRCloud: No results. Status code: ${data.status?.code}, Message: ${data.status?.msg}`);
    }
    
    return [];
  } catch (error) {
    console.error('ACRCloud error:', error);
    return [];
  }
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

// Enhanced AudD recognition
async function recognizeWithAudD(audioFile: File): Promise<EnhancedRecognitionTrack[]> {
  if (!process.env.AUDD_API_TOKEN) {
    console.log('AudD: Missing API token');
    return [];
  }

  try {
    console.log('🔊 AudD: Starting recognition...');
    const formData = new FormData();
    formData.append('api_token', process.env.AUDD_API_TOKEN);
    formData.append('audio', audioFile);
    formData.append('return', 'apple_music,spotify,deezer');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: { 'User-Agent': 'DeadWaxDialogues/1.0' }
    });

    console.log(`🔊 AudD response status: ${response.status}`);

    if (!response.ok) {
      console.warn(`AudD HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log('🔊 AudD response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'success' && data.result) {
      console.log('✅ AudD: Found result');
      let imageUrl: string | undefined;
      let duration: number | undefined;
      
      if (data.result.spotify?.album?.images?.length > 0) {
        imageUrl = data.result.spotify.album.images[0].url;
      } else if (data.result.apple_music?.artwork?.url) {
        imageUrl = data.result.apple_music.artwork.url;
      } else if (data.result.deezer?.album?.cover_big) {
        imageUrl = data.result.deezer.album.cover_big;
      }

      // Extract duration from various sources
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
        confidence: 0.8,
        service: 'AudD',
        source_priority: 2,
        is_guest_vinyl: true,
        duration: duration
      }];
    } else {
      console.log(`❌ AudD: No results. Status: ${data.status}, Error: ${data.error}`);
    }
    
    return [];
  } catch (error) {
    console.error('AudD error:', error);
    return [];
  }
}

// FIXED: Main POST handler with proper error handling and candidate display
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

    console.log(`🎵 AUDIO RECOGNITION: ${audioFile.name}, size: ${audioFile.size} bytes`);

    if (audioFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty audio file' },
        { status: 400 }
      );
    }

    // PHASE 1: Audio Recognition Services (run in parallel for faster response)
    console.log('🔊 Phase 1: Audio recognition services...');
    const audioRecognitionPromises = [
      recognizeWithACRCloud(audioFile),
      recognizeWithAudD(audioFile)
    ];

    const audioResults = await Promise.allSettled(audioRecognitionPromises);
    const allAudioCandidates: EnhancedRecognitionTrack[] = [];
    
    audioResults.forEach((result, index) => {
      const serviceName = ['ACRCloud', 'AudD'][index];
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`✅ ${serviceName}: Found ${result.value.length} candidates`);
        allAudioCandidates.push(...result.value);
      } else {
        console.log(`❌ ${serviceName}: No results`);
      }
    });

    console.log(`📊 Total external candidates found: ${allAudioCandidates.length}`);

    // Check if we have any results at all
    if (allAudioCandidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No audio recognition results from any service',
        servicesQueried: ['ACRCloud', 'AudD'],
        totalCandidatesFound: 0
      } satisfies EnhancedRecognitionResult);
    }

    // Get the best external recognition for artist/track info
    const bestExternalTrack = allAudioCandidates.sort((a, b) => 
      (b.confidence || 0) - (a.confidence || 0)
    )[0];

    console.log(`🎯 Best external recognition: ${bestExternalTrack.artist} - ${bestExternalTrack.title} (${bestExternalTrack.service})`);

    // PHASE 2: COLLECTION SEARCH - HIGHEST PRIORITY
    console.log('🏆 Phase 2: PRIORITY COLLECTION SEARCH (Vinyl > Cassettes > 45s)...');
    
    const collectionMatches = await findBYOCollectionMatches(
      bestExternalTrack.artist, 
      bestExternalTrack.title, 
      bestExternalTrack.album
    );

    let finalTrack: EnhancedRecognitionTrack;
    let candidates: EnhancedRecognitionTrack[] = [];

    // COLLECTION TAKES ABSOLUTE PRIORITY
    if (collectionMatches.length > 0) {
      console.log(`🎉 COLLECTION MATCH FOUND! Using collection priority.`);
      
      const topCollectionMatch = collectionMatches[0]; // Already sorted by priority
      
      finalTrack = {
        artist: topCollectionMatch.artist,
        title: bestExternalTrack.title, // Keep the recognized track title
        album: topCollectionMatch.title, // Collection album title
        image_url: topCollectionMatch.image_url || bestExternalTrack.image_url,
        confidence: 0.95, // High confidence for collection matches
        service: `Collection Match (${topCollectionMatch.folder})`,
        source_priority: 0, // Highest priority
        collection_match: topCollectionMatch,
        is_guest_vinyl: false,
        duration: bestExternalTrack.duration // Keep duration from recognition
      };

      // RESTORED: Add other collection matches as candidates
      candidates = collectionMatches.slice(1, 6).map((match: CollectionMatch): EnhancedRecognitionTrack => ({
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

      // RESTORED: Add ALL external candidates as alternatives
      candidates.push(...allAudioCandidates.map(track => ({
        ...track,
        is_guest_vinyl: true,
        source_priority: 10 // Lower priority
      })));

      console.log(`✅ PRIMARY: Collection match from ${topCollectionMatch.folder} folder`);
      
    } else {
      console.log(`⚠️  NO COLLECTION MATCH - Using external recognition as fallback`);
      
      // No collection match found, use external as primary
      finalTrack = {
        ...bestExternalTrack,
        is_guest_vinyl: true,
        source_priority: 1
      };

      // RESTORED: Add ALL other external results as candidates
      candidates = allAudioCandidates.slice(1).map(track => ({
        ...track,
        is_guest_vinyl: true,
        source_priority: 1
      }));
    }

    console.log(`📊 Final result: Primary + ${candidates.length} candidates`);

    // PHASE 3: Smart Timing Calculation
    console.log('⏰ Phase 3: Smart timing calculation...');
    
    const smartTiming = calculateSmartTiming(finalTrack.duration, 15);
    finalTrack.next_recognition_delay = smartTiming.next_sample_in;
    
    console.log(`🧠 Smart timing: ${smartTiming.reasoning}`);

    // PHASE 4: Database Update with TV Display Refresh
    console.log('💾 Phase 4: Updating database and triggering TV refresh...');
    
    try {
      const updateData = {
        id: 1,
        artist: finalTrack.artist,
        title: finalTrack.title,
        album_title: finalTrack.album,
        recognition_image_url: finalTrack.image_url,
        album_id: finalTrack.collection_match?.id || null,
        started_at: new Date().toISOString(),
        recognition_confidence: finalTrack.confidence || 0.8,
        service_used: finalTrack.service || 'Multi-Service',
        updated_at: new Date().toISOString(),
        track_duration: finalTrack.duration || null,
        next_recognition_in: finalTrack.next_recognition_delay || 30
      };

      const { error: nowPlayingError } = await supabase
        .from('now_playing')
        .upsert(updateData);

      if (nowPlayingError) {
        throw nowPlayingError;
      }

      console.log('✅ Database updated - TV display should refresh automatically');
      
    } catch (dbError) {
      console.error('❌ Database update error:', dbError);
    }

    const servicesQueried = [
      'ACRCloud',
      'AudD', 
      'BYO Collection Search (PRIORITY)',
    ].filter(service => {
      switch (service) {
        case 'ACRCloud': return !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY);
        case 'AudD': return !!process.env.AUDD_API_TOKEN;
        default: return true;
      }
    });

    console.log(`🎉 Recognition complete!`);
    console.log(`📊 Primary: ${finalTrack.service} | Collection: ${!!finalTrack.collection_match} | Candidates: ${candidates.length} | Duration: ${finalTrack.duration}s`);

    return NextResponse.json({
      success: true,
      track: finalTrack,
      candidates: candidates,
      servicesQueried,
      totalCandidatesFound: allAudioCandidates.length + collectionMatches.length,
      albumContextUsed: false,
      albumContextSwitched: false,
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
        totalCandidatesFound: 0
      } satisfies EnhancedRecognitionResult,
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const services = [
    { 
      name: 'BYO Collection Search', 
      enabled: true,
      priority: 0,
      description: 'PRIORITY: Vinyl > Cassettes > 45s folders ONLY'
    },
    { 
      name: 'ACRCloud', 
      enabled: !!(process.env.ACRCLOUD_ACCESS_KEY && process.env.ACRCLOUD_SECRET_KEY),
      priority: 1
    },
    { 
      name: 'AudD', 
      enabled: !!process.env.AUDD_API_TOKEN,
      priority: 2
    }
  ];

  const enabledServices = services.filter(s => s.enabled);

  return NextResponse.json({ 
    message: 'BYO Vinyl Collection-Priority Audio Recognition API',
    version: '4.1.0',
    enabledServices: enabledServices.map(s => `${s.name} (Priority: ${s.priority})`),
    features: [
      'COLLECTION ABSOLUTE PRIORITY - Vinyl > Cassettes > 45s',
      'Smart timing based on track duration',
      'ALL candidates from ALL services displayed',
      'Real-time TV display updates',
      'Enhanced duration extraction',
      'Proper error handling and logging'
    ],
    collectionPriority: {
      1: 'Vinyl (highest priority)',
      2: 'Cassettes', 
      3: '45s',
      999: 'External services (fallback only)'
    },
    smartTiming: {
      enabled: true,
      description: 'Calculates optimal next sample time based on track duration',
      fallback: '30s if no duration available'
    }
  });
}