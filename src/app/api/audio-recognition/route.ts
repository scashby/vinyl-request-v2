// src/app/api/audio-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';

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
      
      // If it's been less than the expected next recognition time, skip
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
  // Default to 3 minutes for unknown tracks
  let estimatedDuration = 180;
  
  // You could enhance this by calling Spotify API or using track metadata
  // For now, use some basic heuristics
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('interlude') || titleLower.includes('intro')) {
    estimatedDuration = 60; // 1 minute
  } else if (titleLower.includes('extended') || titleLower.includes('long')) {
    estimatedDuration = 480; // 8 minutes
  } else if (titleLower.includes('radio edit') || titleLower.includes('single')) {
    estimatedDuration = 210; // 3.5 minutes
  }
  
  // Return 80% of estimated duration to catch the next track
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
    // Find best match
    const exactMatch = matches.find(m => 
      m.artist?.toLowerCase() === artist.toLowerCase() ||
      m.title?.toLowerCase().includes(title.toLowerCase())
    );
    return exactMatch || matches[0];
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📡 Starting audio recognition...');
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'No audio file provided'
      }, { status: 400 });
    }

    console.log(`📁 Received audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);

    // Convert audio file to base64 for Shazam API
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    console.log('🎵 Calling Shazam API...');

    // Call Shazam API via RapidAPI
    const shazamResponse = await fetch('https://shazam.p.rapidapi.com/songs/v2/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-RapidAPI-Key': process.env.SHAZAM_RAPID_API_KEY!,
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
      },
      body: base64Audio
    });

    if (!shazamResponse.ok) {
      console.error('Shazam API error:', shazamResponse.status, shazamResponse.statusText);
      return NextResponse.json({
        success: false,
        error: `Shazam API error: ${shazamResponse.status}`
      }, { status: 500 });
    }

    const shazamData: ShazamResponse = await shazamResponse.json();
    console.log('🎯 Shazam response received:', shazamData.track ? 'Match found' : 'No match');

    if (!shazamData.track) {
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
        error: 'No track identified',
        raw: shazamData
      });
    }

    const track = shazamData.track;
    const artist = track.subtitle || 'Unknown Artist';
    const title = track.title || 'Unknown Title';
    const imageUrl = track.images?.coverarthq || track.images?.coverart || track.images?.background;

    console.log(`🎼 Identified: ${artist} - ${title}`);

    // Check if this is a duplicate recognition
    const contextCheck = await checkCurrentContext(artist, title);
    if (contextCheck.isDuplicate) {
      console.log('⏭️ Duplicate track detected, skipping...');
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        track: { artist, title },
        nowPlaying: contextCheck.currentTrack,
        nextRecognitionIn: contextCheck.remainingTime,
        message: 'Same track still playing'
      });
    }

    // Calculate next recognition time
    const nextRecognitionIn = calculateNextRecognitionTime(artist, title);

    // Find album info from track sections
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
    
    // Calculate confidence (Shazam doesn't provide this, so we estimate)
    const confidence = shazamData.matches?.length > 0 ? 0.9 : 0.7;

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
      console.error('Error logging recognition:', logError);
    }

    // Clear any existing now_playing entries
    await supabase.from('now_playing').delete().neq('id', 0);

    // Create new now_playing entry
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
      console.error('Error creating now_playing entry:', nowPlayingError);
    }

    // Update album context for better future recognition
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
        console.log('📚 Album context updated');
      }
    } catch (error) {
      console.log('⚠️ Could not update album context:', error);
    }

    console.log(`✅ Recognition complete: ${artist} - ${title}`);

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
      logId: logEntry?.id
    });

  } catch (error) {
    console.error('Recognition API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}