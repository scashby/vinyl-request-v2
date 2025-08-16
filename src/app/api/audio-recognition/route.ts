// src/app/api/audio-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'src/lib/supabaseClient';

interface ShazamResponse {
  track?: {
    title: string;
    subtitle: string; // artist
    key: string;
    images?: {
      background?: string;
      coverart?: string;
      coverarthq?: string;
    };
    sections?: Array<{
      type: string;
      metadata?: Array<{
        title: string;
        text: string;
      }>;
    }>;
  };
  matches?: Array<{
    id: string;
    offset: number;
    timeskew: number;
    frequencyskew: number;
  }>;
  timestamp?: number;
  timezone?: string;
  location?: unknown;
}

// Helper function to check if a track is already playing
async function checkCurrentContext(artist: string, title: string) {
  const { data: currentTrack } = await supabase
    .from('now_playing')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (currentTrack) {
    const isSameTrack = 
      currentTrack.artist?.toLowerCase() === artist.toLowerCase() &&
      currentTrack.title?.toLowerCase() === title.toLowerCase();

    if (isSameTrack) {
      const timeSinceStart = Date.now() - new Date(currentTrack.started_at).getTime();
      const timeSinceStartSeconds = Math.floor(timeSinceStart / 1000);
      
      if (currentTrack.next_recognition_in && timeSinceStartSeconds < currentTrack.next_recognition_in) {
        return {
          isDuplicate: true,
          currentTrack,
          remainingTime: currentTrack.next_recognition_in - timeSinceStartSeconds
        };
      }
    }
  }

  return { isDuplicate: false };
}

// Helper function to estimate track duration and set next recognition time
function calculateNextRecognitionTime(artist: string, title: string): number {
  let estimatedDuration = 180; // Default to 3 minutes
  
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('interlude') || titleLower.includes('intro')) {
    estimatedDuration = 60; // 1 minute
  } else if (titleLower.includes('extended') || titleLower.includes('long')) {
    estimatedDuration = 480; // 8 minutes
  } else if (titleLower.includes('radio edit') || titleLower.includes('single')) {
    estimatedDuration = 210; // 3.5 minutes
  }
  
  return Math.floor(estimatedDuration * 0.8);
}

// Helper function to match with collection
async function findCollectionMatch(artist: string, title: string) {
  const { data: matches } = await supabase
    .from('collection')
    .select('*')
    .or(`artist.ilike.%${artist}%,title.ilike.%${title}%`)
    .limit(5);

  if (matches && matches.length > 0) {
    const exactMatch = matches.find(m => 
      m.artist?.toLowerCase() === artist.toLowerCase() ||
      m.title?.toLowerCase().includes(title.toLowerCase())
    );
    return exactMatch || matches[0];
  }
  
  return null;
}

// Enhanced audio file validation and processing
async function processAudioFile(audioFile: File): Promise<{ 
  isValid: boolean; 
  audioBuffer?: ArrayBuffer; 
  base64Audio?: string; 
  details: string; 
}> {
  console.log(`📁 Processing audio file:`, {
    name: audioFile.name,
    size: audioFile.size,
    type: audioFile.type,
    lastModified: new Date(audioFile.lastModified).toISOString()
  });

  // Check file size (should be reasonable for 10 seconds of audio)
  if (audioFile.size === 0) {
    return { isValid: false, details: 'File is empty (0 bytes)' };
  }
  
  if (audioFile.size > 10 * 1024 * 1024) { // 10MB limit
    return { isValid: false, details: `File too large: ${audioFile.size} bytes` };
  }

  if (audioFile.size < 1000) { // Less than 1KB seems too small
    return { isValid: false, details: `File too small: ${audioFile.size} bytes` };
  }

  try {
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    console.log(`✅ Audio conversion successful:`, {
      originalSize: audioFile.size,
      base64Length: base64Audio.length,
      base64Sample: base64Audio.substring(0, 100) + '...'
    });

    return {
      isValid: true,
      audioBuffer: arrayBuffer,
      base64Audio,
      details: `Converted ${audioFile.size} bytes to ${base64Audio.length} base64 chars`
    };
  } catch (error) {
    return { 
      isValid: false, 
      details: `Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 =================================');
  console.log('📡 Starting audio recognition...');
  console.log('🕐 Timestamp:', new Date().toISOString());
  
  try {
    // Extract and validate form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file provided in form data');
      console.log('📋 Available form data keys:', Array.from(formData.keys()));
      return NextResponse.json({
        success: false,
        error: 'No audio file provided'
      }, { status: 400 });
    }

    // Process and validate audio file
    const audioProcessResult = await processAudioFile(audioFile);
    
    if (!audioProcessResult.isValid) {
      console.error('❌ Audio file validation failed:', audioProcessResult.details);
      return NextResponse.json({
        success: false,
        error: `Audio file invalid: ${audioProcessResult.details}`
      }, { status: 400 });
    }

    const { base64Audio } = audioProcessResult;

    // Validate API key
    if (!process.env.SHAZAM_RAPID_API_KEY) {
      console.error('❌ SHAZAM_RAPID_API_KEY environment variable not set');
      return NextResponse.json({
        success: false,
        error: 'Shazam API key not configured'
      }, { status: 500 });
    }

    console.log('🔑 API Key present:', process.env.SHAZAM_RAPID_API_KEY.substring(0, 10) + '...');
    console.log('🎵 Calling Shazam API...');

    // Prepare API call with detailed logging
    const apiUrl = 'https://shazam.p.rapidapi.com/songs/v2/detect';
    const headers = {
      'Content-Type': 'text/plain',
      'X-RapidAPI-Key': process.env.SHAZAM_RAPID_API_KEY,
      'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
    };

    console.log('🌐 API Request details:', {
      url: apiUrl,
      method: 'POST',
      headers: { ...headers, 'X-RapidAPI-Key': headers['X-RapidAPI-Key'].substring(0, 10) + '...' },
      bodyLength: base64Audio!.length,
      bodySample: base64Audio!.substring(0, 50) + '...'
    });

    const shazamResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: base64Audio
    });

    console.log('📡 Shazam API Response:', {
      status: shazamResponse.status,
      statusText: shazamResponse.statusText,
      headers: Object.fromEntries(shazamResponse.headers.entries()),
      ok: shazamResponse.ok
    });

    // Handle non-200 responses
    if (!shazamResponse.ok) {
      let errorDetails = `HTTP ${shazamResponse.status} ${shazamResponse.statusText}`;
      
      try {
        const errorBody = await shazamResponse.text();
        console.error('❌ Shazam API error body:', errorBody);
        errorDetails += ` - ${errorBody}`;
      } catch (e) {
        console.error('❌ Could not read error response body:', e);
      }

      return NextResponse.json({
        success: false,
        error: `Shazam API error: ${errorDetails}`
      }, { status: 500 });
    }

    // Parse response
    let shazamData: ShazamResponse;
    const responseText = await shazamResponse.text();
    
    console.log('📄 Raw API Response:', {
      length: responseText.length,
      sample: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
      isEmpty: responseText.trim() === ''
    });

    try {
      shazamData = JSON.parse(responseText);
      console.log('✅ Parsed Shazam response:', {
        hasTrack: !!shazamData.track,
        hasMatches: !!shazamData.matches,
        matchesCount: shazamData.matches?.length || 0,
        trackTitle: shazamData.track?.title,
        trackArtist: shazamData.track?.subtitle,
        responseKeys: Object.keys(shazamData)
      });
    } catch (parseError) {
      console.error('❌ Failed to parse Shazam response as JSON:', parseError);
      console.error('📄 Raw response that failed to parse:', responseText);
      
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON response from Shazam API',
        rawResponse: responseText.substring(0, 1000) // Limit size
      }, { status: 500 });
    }

    // Check if we got a track match
    if (!shazamData.track) {
      console.log('❌ No track found in Shazam response');
      console.log('🔍 Full response for debugging:', JSON.stringify(shazamData, null, 2));
      
      // Log failed recognition
      await supabase.from('audio_recognition_logs').insert({
        artist: null,
        title: null,
        album: null,
        source: 'microphone',
        service: 'shazam',
        confidence: 0,
        confirmed: false,
        raw_response: shazamData,
        created_at: new Date().toISOString()
      });

      return NextResponse.json({
        success: false,
        error: 'No track identified by Shazam',
        debugInfo: {
          hasMatches: !!shazamData.matches,
          matchesCount: shazamData.matches?.length || 0,
          responseKeys: Object.keys(shazamData),
          processingTime: Date.now() - startTime
        },
        rawResponse: shazamData
      });
    }

    // Extract track information
    const track = shazamData.track;
    const artist = track.subtitle || 'Unknown Artist';
    const title = track.title || 'Unknown Title';
    const imageUrl = track.images?.coverarthq || track.images?.coverart || track.images?.background;

    console.log('🎼 Track identified:', {
      artist,
      title,
      shazamKey: track.key,
      hasImage: !!imageUrl,
      imageUrl: imageUrl?.substring(0, 100) + (imageUrl && imageUrl.length > 100 ? '...' : ''),
      matchesCount: shazamData.matches?.length || 0
    });

    // Check if this is a duplicate recognition
    const contextCheck = await checkCurrentContext(artist, title);
    if (contextCheck.isDuplicate) {
      console.log('⏭️ Duplicate track detected, skipping database updates');
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        track: { artist, title },
        nowPlaying: contextCheck.currentTrack,
        nextRecognitionIn: contextCheck.remainingTime,
        message: 'Same track still playing',
        processingTime: Date.now() - startTime
      });
    }

    // Calculate next recognition time and extract album info
    const nextRecognitionIn = calculateNextRecognitionTime(artist, title);
    
    let albumTitle = null;
    if (track.sections) {
      for (const section of track.sections) {
        if (section.type === 'SONG' && section.metadata) {
          const albumMeta = section.metadata.find(m => m.title === 'Album');
          if (albumMeta) {
            albumTitle = albumMeta.text;
            break;
          }
        }
      }
    }

    // Check for collection match
    const collectionMatch = await findCollectionMatch(artist, title);
    
    // Calculate confidence (estimate based on matches)
    const confidence = shazamData.matches?.length > 0 ? 0.9 : 0.7;

    console.log('💾 Saving recognition data:', {
      artist,
      title,
      album: albumTitle,
      confidence,
      collectionMatch: !!collectionMatch,
      collectionId: collectionMatch?.id
    });

    // Log the recognition
    const { data: logEntry, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
        artist,
        title,
        album: albumTitle,
        source: 'microphone',
        service: 'shazam',
        confidence,
        confirmed: true,
        match_source: collectionMatch ? 'collection' : null,
        matched_id: collectionMatch?.id || null,
        raw_response: shazamData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Error logging recognition:', logError);
    } else {
      console.log('✅ Recognition logged with ID:', logEntry?.id);
    }

    // Clear any existing now_playing entries and create new one
    await supabase.from('now_playing').delete().neq('id', 0);

    const { data: nowPlayingData, error: nowPlayingError } = await supabase
      .from('now_playing')
      .insert({
        artist,
        title,
        album_title: albumTitle,
        album_id: collectionMatch?.id || null,
        started_at: new Date().toISOString(),
        recognition_confidence: confidence,
        service_used: 'shazam',
        recognition_image_url: imageUrl,
        next_recognition_in: nextRecognitionIn,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (nowPlayingError) {
      console.error('❌ Error creating now_playing entry:', nowPlayingError);
    } else {
      console.log('✅ Now playing entry created with ID:', nowPlayingData?.id);
    }

    // Update album context
    try {
      const albumContextResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/album-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist,
          title,
          album: albumTitle || title,
          year: collectionMatch?.year,
          collectionId: collectionMatch?.id,
          source: 'audio_recognition'
        })
      });
      
      if (albumContextResponse.ok) {
        console.log('📚 Album context updated successfully');
      } else {
        console.log('⚠️ Album context update failed:', albumContextResponse.status);
      }
    } catch (error) {
      console.log('⚠️ Could not update album context:', error);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Recognition complete in ${processingTime}ms: ${artist} - ${title}`);
    console.log('🚀 =================================');

    return NextResponse.json({
      success: true,
      track: {
        artist,
        title,
        album: albumTitle,
        image_url: imageUrl,
        confidence,
        service: 'shazam',
        shazam_key: track.key
      },
      nowPlaying: nowPlayingData,
      collectionMatch: collectionMatch ? {
        id: collectionMatch.id,
        folder: collectionMatch.folder,
        format: collectionMatch.format
      } : null,
      nextRecognitionIn,
      logId: logEntry?.id,
      debugInfo: {
        processingTime,
        audioFileSize: audioFile.size,
        base64Length: base64Audio!.length,
        matchesCount: shazamData.matches?.length || 0
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Critical error in audio recognition:', error);
    console.error('📊 Error context:', {
      processingTime,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.log('🚀 =================================');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      debugInfo: {
        processingTime,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    }, { status: 500 });
  }
}