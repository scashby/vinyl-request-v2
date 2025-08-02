// src/app/api/album-context/route.ts
// Phase 2: Enhanced Album Context with Sequential Recognition Intelligence

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AlbumContextRequest {
  artist: string;
  title: string;
  album: string;
  year?: string;
  collectionId?: number;
  source?: string;
  trackNumber?: number;
  side?: string;
}

interface AlbumContext {
  id: number;
  artist: string;
  title: string;
  album: string;
  year: string;
  collection_id?: number;
  source: string;
  created_at: string;
  updated_at?: string;
  track_count?: number;
  last_track_recognized?: string;
  recognition_sequence?: number;
  album_confidence?: number;
}

// Intelligence: Check if this track fits the current album context
async function analyzeSequentialContext(
  artist: string, 
  album: string, 
  currentContext: AlbumContext | null
): Promise<{
  isSequential: boolean;
  confidence: number;
  reason: string;
  shouldUpdateContext: boolean;
}> {
  if (!currentContext) {
    return {
      isSequential: false,
      confidence: 0,
      reason: 'No existing album context',
      shouldUpdateContext: true
    };
  }

  // Check if artist matches
  const artistMatch = currentContext.artist.toLowerCase() === artist.toLowerCase();
  const albumMatch = currentContext.album.toLowerCase() === album.toLowerCase();

  if (artistMatch && albumMatch) {
    // Perfect match - this is likely the next track on the same album
    return {
      isSequential: true,
      confidence: 0.95,
      reason: 'Perfect artist and album match - sequential track detected',
      shouldUpdateContext: false // Keep existing context, just update sequence
    };
  }

  if (artistMatch && !albumMatch) {
    // Same artist, different album - possible album change
    return {
      isSequential: false,
      confidence: 0.7,
      reason: 'Same artist, different album - album change detected',
      shouldUpdateContext: true
    };
  }

  if (!artistMatch) {
    // Different artist - definite change
    return {
      isSequential: false,
      confidence: 0.9,
      reason: 'Different artist - clear context change',
      shouldUpdateContext: true
    };
  }

  return {
    isSequential: false,
    confidence: 0.5,
    reason: 'Uncertain match',
    shouldUpdateContext: true
  };
}

// GET - Get current album context with intelligence
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('album_context')
      .select(`
        *,
        collection:collection_id(
          id,
          artist,
          title,
          year,
          image_url,
          folder,
          tracklists
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch album context',
        details: error.message
      }, { status: 500 });
    }

    // Enhanced context analysis
    let contextAnalysis = null;
    if (data) {
      // Check how long this context has been active
      const contextAge = Date.now() - new Date(data.created_at).getTime();
      const ageInMinutes = Math.floor(contextAge / (1000 * 60));
      
      // Get recent recognition logs to analyze listening pattern
      const { data: recentLogs } = await supabase
        .from('audio_recognition_logs')
        .select('artist, album, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const sameAlbumCount = recentLogs?.filter(log => 
        log.artist?.toLowerCase() === data.artist?.toLowerCase() &&
        log.album?.toLowerCase() === data.album?.toLowerCase()
      ).length || 0;

      contextAnalysis = {
        ageInMinutes,
        isActive: ageInMinutes < 60, // Context is active if less than 1 hour old
        consecutiveTracksFromAlbum: sameAlbumCount,
        listeningPattern: sameAlbumCount >= 3 ? 'album_listening' : 'track_skipping',
        recommendation: sameAlbumCount >= 3 ? 
          'Continue expecting tracks from this album' : 
          'Monitor for potential album changes'
      };
    }
    
    return NextResponse.json({
      success: true,
      data: data || null,
      contextAnalysis,
      message: data ? "Album context found with intelligence" : "No album context set"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Set album context with sequential intelligence
export async function POST(request: NextRequest) {
  try {
    const body: AlbumContextRequest = await request.json();
    const { 
      artist, 
      title, 
      album, 
      year, 
      collectionId, 
      source = 'manual'
      // trackNumber and side reserved for future use
    } = body;
    
    if (!artist || !title || !album) {
      return NextResponse.json({
        success: false,
        error: "Artist, title, and album are required"
      }, { status: 400 });
    }
    
    console.log(`📚 Setting album context with intelligence: ${artist} - ${album}`);
    
    // Get current context for analysis
    const { data: currentContext } = await supabase
      .from('album_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Analyze if this is sequential or a context change
    const sequentialAnalysis = await analyzeSequentialContext(artist, album, currentContext);
    console.log(`🧠 Sequential analysis: ${sequentialAnalysis.reason} (confidence: ${sequentialAnalysis.confidence})`);

    let contextAction = 'create_new';
    let updatedData;

    if (sequentialAnalysis.isSequential && currentContext) {
      // Update existing context with new track info
      contextAction = 'update_sequential';
      const { data, error } = await supabase
        .from('album_context')
        .update({
          last_track_recognized: title,
          recognition_sequence: (currentContext.recognition_sequence || 0) + 1,
          album_confidence: Math.min((currentContext.album_confidence || 0.8) + 0.1, 1.0),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentContext.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      updatedData = data;
    } else {
      // Clear existing and create new context
      contextAction = 'create_new';
      await supabase.from('album_context').delete().neq('id', 0);
      
      // Get additional info from collection if collectionId provided
      let collectionInfo = null;
      if (collectionId) {
        const { data: collection } = await supabase
          .from('collection')
          .select('*')
          .eq('id', collectionId)
          .single();
        
        collectionInfo = collection;
      }
      
      // Insert new album context
      const { data, error } = await supabase
        .from('album_context')
        .insert({
          artist,
          title: album, // Album title goes in title field
          album,
          year: year || collectionInfo?.year || new Date().getFullYear().toString(),
          collection_id: collectionId || null,
          source,
          last_track_recognized: title,
          recognition_sequence: 1,
          album_confidence: 0.8,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      updatedData = data;
    }
    
    return NextResponse.json({
      success: true,
      data: updatedData,
      sequentialAnalysis,
      contextAction,
      message: `Album context ${contextAction === 'update_sequential' ? 'updated' : 'set'}: ${artist} - ${album}`,
      intelligence: {
        isSequentialTrack: sequentialAnalysis.isSequential,
        confidence: sequentialAnalysis.confidence,
        recommendation: sequentialAnalysis.reason,
        trackSequence: updatedData.recognition_sequence || 1
      }
    });
    
  } catch (error) {
    console.error('Album Context API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT - Update album context with enhanced tracking
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, trackTitle, confidence, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Album context ID is required"
      }, { status: 400 });
    }

    // Enhanced update with tracking
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // If track title provided, update tracking
    if (trackTitle) {
      updateData.last_track_recognized = trackTitle;
      
      // Get current data to increment sequence
      const { data: current } = await supabase
        .from('album_context')
        .select('recognition_sequence, album_confidence')
        .eq('id', id)
        .single();

      if (current) {
        updateData.recognition_sequence = (current.recognition_sequence || 0) + 1;
        updateData.album_confidence = Math.min(
          (current.album_confidence || 0.8) + (confidence ? confidence * 0.1 : 0.05), 
          1.0
        );
      }
    }
    
    const { data, error } = await supabase
      .from('album_context')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update album context',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: "Album context updated with enhanced tracking"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Clear album context with logging
export async function DELETE() {
  try {
    // Get current context for logging
    const { data: currentContext } = await supabase
      .from('album_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { error } = await supabase
      .from('album_context')
      .delete()
      .neq('id', 0);
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to clear album context',
        details: error.message
      }, { status: 500 });
    }

    console.log('📚 Album context cleared:', currentContext ? 
      `${currentContext.artist} - ${currentContext.album} (${currentContext.recognition_sequence || 1} tracks)` : 
      'No context was active'
    );
    
    return NextResponse.json({
      success: true,
      message: "Album context cleared",
      previousContext: currentContext ? {
        artist: currentContext.artist,
        album: currentContext.album,
        trackCount: currentContext.recognition_sequence || 1
      } : null
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}