// src/app/api/audio-recognition/collection/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CollectionMatchRequest {
  audioData: string;
  triggeredBy?: string;
  timestamp?: string;
}

interface CollectionMatch {
  id: number;
  artist: string;
  title: string;
  album: string;
  year?: string;
  image_url?: string;
  folder?: string;
  confidence: number;
  source: string;
  service: string;
}

// Simulate collection fingerprint matching
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function simulateCollectionMatch(_audioData: string): Promise<CollectionMatch | null> {
  // Simulate processing delay based on audio data (in real implementation, this would fingerprint the audio)
  // Note: _audioData is prefixed with underscore to indicate it's intentionally unused in simulation mode
  const processingDelay = 500 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, processingDelay));
  
  // Query actual collection for simulation
  try {
    const { data: collection, error } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .limit(20);
    
    if (error || !collection || collection.length === 0) {
      console.log('No collection data available for simulation');
      return null;
    }
    
    // 60% chance of finding a match in collection (higher than external since it's your own music)
    if (Math.random() > 0.4) {
      const randomAlbum = collection[Math.floor(Math.random() * collection.length)];
      
      // Simulate track within the album
      const trackTitles = [
        "Opening Track",
        "Side A Track 1", 
        "Side A Track 2",
        "Side A Track 3",
        "Side B Track 1",
        "Side B Track 2",
        "Closing Track"
      ];
      
      const simulatedTrack = trackTitles[Math.floor(Math.random() * trackTitles.length)];
      
      return {
        id: randomAlbum.id,
        artist: randomAlbum.artist,
        title: simulatedTrack,
        album: randomAlbum.title,
        year: randomAlbum.year || undefined,
        image_url: randomAlbum.image_url || undefined,
        folder: randomAlbum.folder || undefined,
        confidence: 0.85 + Math.random() * 0.15, // High confidence for collection matches
        source: 'collection',
        service: 'collection_fingerprint'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error simulating collection match:', error);
    return null;
  }
}

// GET - Return collection match service status
export async function GET() {
  try {
    // Check collection size
    const { count, error } = await supabase
      .from('collection')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to collection database',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: "Collection Match API is running",
      status: "simulation_mode",
      collectionSize: count || 0,
      features: ["audio_fingerprinting", "collection_search", "track_matching"],
      version: "1.0.0"
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Process collection matching
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: CollectionMatchRequest = await request.json();
    const { audioData, triggeredBy = 'collection_manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🏆 Processing collection match (${triggeredBy}) - Audio size: ${audioData.length} chars`);
    
    // Simulate collection fingerprint matching
    const result = await simulateCollectionMatch(audioData);
    const processingTime = Date.now() - startTime;
    
    if (!result) {
      // Log failed collection match
      await supabase.from('audio_recognition_logs').insert({
        artist: null,
        title: null,
        album: null,
        source: 'collection',
        service: 'collection_fingerprint',
        confidence: 0,
        confirmed: false,
        match_source: 'collection',
        matched_id: null,
        now_playing: false,
        raw_response: { error: 'No collection match found', triggered_by: triggeredBy },
        created_at: new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        error: "No match found in collection",
        processingTime,
        details: "Collection fingerprint matching completed but no match was found",
        collectionSearched: true
      });
    }
    
    // Log successful collection match
    const { data: logData, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
        artist: result.artist,
        title: result.title,
        album: result.album,
        source: 'collection',
        service: result.service,
        confidence: result.confidence,
        confirmed: false,
        match_source: 'collection',
        matched_id: result.id,
        now_playing: false,
        raw_response: { ...result, triggered_by: triggeredBy, processing_time: processingTime },
        created_at: new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to log collection match:', logError);
    } else {
      console.log(`✅ Collection match logged with ID: ${logData?.id}`);
    }
    
    // Update now playing with collection match
    const { error: nowPlayingError } = await supabase
      .from('now_playing')
      .upsert({
        id: 1,
        artist: result.artist,
        title: result.title,
        album_title: result.album,
        album_id: result.id, // Collection album ID
        recognition_image_url: result.image_url,
        started_at: new Date().toISOString(),
        recognition_confidence: result.confidence,
        service_used: result.service,
        next_recognition_in: 25, // Slightly faster next recognition for collection tracks
        updated_at: new Date().toISOString()
      });
    
    if (nowPlayingError) {
      console.error('Failed to update now playing:', nowPlayingError);
    } else {
      console.log('✅ Now playing updated with collection match');
    }
    
    // Set album context with collection info
    await supabase.from('album_context').delete().neq('id', 0); // Clear existing
    await supabase.from('album_context').insert({
      artist: result.artist,
      title: result.album,
      album: result.album,
      year: result.year || new Date().getFullYear().toString(),
      collection_id: result.id,
      source: 'collection_match',
      created_at: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      result: {
        ...result,
        processingTime,
        matchType: 'collection'
      },
      processingTime,
      logId: logData?.id,
      triggeredBy,
      message: `Collection match found: ${result.artist} - ${result.title}`,
      collectionMatch: true
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Collection Match API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      details: "Error occurred during collection matching"
    }, { status: 500 });
  }
}