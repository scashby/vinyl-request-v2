// src/app/api/manual-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ManualRecognitionRequest {
  artist: string;
  title: string;
  album?: string;
  albumId?: number;
  confidence?: number;
  source?: string;
}

// GET - Return manual recognition service status
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Manual Recognition API is running",
    endpoints: {
      "POST /api/manual-recognition": "Manually set track information",
      "PUT /api/manual-recognition/confirm": "Confirm recognition result",
      "DELETE /api/manual-recognition/clear": "Clear now playing"
    },
    features: ["manual_override", "confirmation", "collection_linking"],
    version: "1.0.0"
  });
}

// POST - Manually set track recognition
export async function POST(request: NextRequest) {
  try {
    const body: ManualRecognitionRequest = await request.json();
    const { 
      artist, 
      title, 
      album, 
      albumId, 
      confidence = 1.0, 
      source = 'manual_override' 
    } = body;
    
    if (!artist || !title) {
      return NextResponse.json({
        success: false,
        error: "Artist and title are required"
      }, { status: 400 });
    }
    
    console.log(`🎵 Manual recognition: ${artist} - ${title}`);
    
    // Log manual recognition
    const { data: logData, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
        artist,
        title,
        album: album || null,
        source: 'manual',
        service: 'manual_override',
        confidence,
        confirmed: true, // Manual entries are pre-confirmed
        match_source: albumId ? 'collection' : 'manual',
        matched_id: albumId || null,
        now_playing: true,
        raw_response: { 
          manual_entry: true, 
          album_id: albumId,
          source: source,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to log manual recognition:', logError);
      return NextResponse.json({
        success: false,
        error: 'Failed to log recognition',
        details: logError.message
      }, { status: 500 });
    }
    
    // Get collection info if albumId provided
    let collectionInfo = null;
    if (albumId) {
      const { data: collection } = await supabase
        .from('collection')
        .select('*')
        .eq('id', albumId)
        .single();
      
      collectionInfo = collection;
    }
    
    // Update now playing
    const { error: nowPlayingError } = await supabase
      .from('now_playing')
      .upsert({
        id: 1,
        artist,
        title,
        album_title: album || null,
        album_id: albumId || null,
        recognition_image_url: collectionInfo?.image_url || null,
        started_at: new Date().toISOString(),
        recognition_confidence: confidence,
        service_used: 'manual_override',
        next_recognition_in: null, // Manual entries don't trigger auto-recognition
        updated_at: new Date().toISOString()
      });
    
    if (nowPlayingError) {
      console.error('Failed to update now playing:', nowPlayingError);
      return NextResponse.json({
        success: false,
        error: 'Failed to update now playing',
        details: nowPlayingError.message
      }, { status: 500 });
    }
    
    // Set album context if album provided
    if (album) {
      await supabase.from('album_context').delete().neq('id', 0); // Clear existing
      await supabase.from('album_context').insert({
        artist,
        title: album,
        album,
        year: collectionInfo?.year || new Date().getFullYear().toString(),
        collection_id: albumId || null,
        source: 'manual_override',
        created_at: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: true,
      result: {
        artist,
        title,
        album,
        albumId,
        confidence,
        source: 'manual',
        service: 'manual_override',
        collectionInfo
      },
      logId: logData.id,
      message: `Manual recognition set: ${artist} - ${title}`,
      nowPlayingUpdated: true,
      albumContextSet: !!album
    });
    
  } catch (error) {
    console.error('Manual Recognition API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: "Error occurred during manual recognition"
    }, { status: 500 });
  }
}

// PUT - Confirm a recognition result
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId, confirmed = true } = body;
    
    if (!logId) {
      return NextResponse.json({
        success: false,
        error: "Log ID is required"
      }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('audio_recognition_logs')
      .update({ 
        confirmed,
        updated_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update recognition log',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Recognition ${confirmed ? 'confirmed' : 'rejected'}`,
      data
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Clear now playing
export async function DELETE() {
  try {
    // Clear now playing
    const { error: nowPlayingError } = await supabase
      .from('now_playing')
      .update({
        artist: null,
        title: null,
        album_title: null,
        album_id: null,
        recognition_image_url: null,
        next_recognition_in: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);
    
    if (nowPlayingError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to clear now playing',
        details: nowPlayingError.message
      }, { status: 500 });
    }
    
    // Clear album context
    await supabase.from('album_context').delete().neq('id', 0);
    
    return NextResponse.json({
      success: true,
      message: "Now playing and album context cleared"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}