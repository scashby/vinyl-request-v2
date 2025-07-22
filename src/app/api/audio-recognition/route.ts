// src/app/api/audio-recognition/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

// Mock recognition services for testing
const mockRecognitionServices = {
  acrcloud: async () => ({
    success: true,
    artist: 'The Beatles',
    title: 'Hey Jude',
    album: 'The Beatles 1967-1970',
    confidence: 0.95,
    source: 'ACRCloud'
  }),
  audd: async () => ({
    success: true,
    artist: 'Pink Floyd',
    title: 'Wish You Were Here',
    album: 'Wish You Were Here',
    confidence: 0.88,
    source: 'AudD'
  }),
  acoustid: async () => ({
    success: false,
    error: 'API key invalid',
    source: 'AcoustID'
  })
};

// Simulate actual recognition workflow
async function simulateRecognition() {
  // Try services in priority order
  const services = ['acrcloud', 'audd', 'acoustid'];
  
  for (const service of services) {
    try {
      const result = await mockRecognitionServices[service]();
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.warn(`${service} failed:`, error);
      continue;
    }
  }
  
  return null;
}

export async function GET() {
  return NextResponse.json({
    message: 'Audio Recognition API is available',
    services: ['ACRCloud', 'AudD', 'AcoustID'],
    status: 'active'
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body = await request.json();
    
    console.log('Audio recognition triggered:', body);

    // Simulate recognition process
    const recognitionResult = await simulateRecognition();
    
    if (!recognitionResult) {
      // Log failed recognition attempt
      await supabase.from('audio_recognition_logs').insert({
        artist: null,
        title: null,
        album: null,
        source: 'failed_recognition',
        service: 'all_services',
        confidence: 0,
        confirmed: false,
        created_at: new Date().toISOString(),
        raw_response: { error: 'All services failed' }
      });

      return NextResponse.json(
        { 
          success: false, 
          error: 'Recognition failed - no services available',
          message: 'All recognition services failed or returned no results'
        },
        { status: 500 }
      );
    }

    // Check if this track is in our collection
    const { data: collectionMatch } = await supabase
      .from('collection')
      .select('*')
      .ilike('artist', `%${recognitionResult.artist}%`)
      .ilike('title', `%${recognitionResult.title}%`)
      .limit(1)
      .single();

    // Log the recognition
    const { data: logEntry, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
        artist: recognitionResult.artist,
        title: recognitionResult.title,
        album: recognitionResult.album,
        source: recognitionResult.source,
        service: recognitionResult.source,
        confidence: recognitionResult.confidence,
        confirmed: false,
        match_source: collectionMatch ? 'collection' : null,
        matched_id: collectionMatch?.id || null,
        created_at: new Date().toISOString(),
        raw_response: recognitionResult
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging recognition:', logError);
      return NextResponse.json(
        { success: false, error: 'Failed to log recognition' },
        { status: 500 }
      );
    }

    // Auto-confirm high confidence matches that are in our collection
    if (recognitionResult.confidence >= 0.9 && collectionMatch) {
      // Update now playing
      await supabase.from('now_playing').delete().neq('id', 0);
      await supabase.from('now_playing').insert({
        artist: recognitionResult.artist,
        title: recognitionResult.title,
        album_title: recognitionResult.album,
        album_id: collectionMatch.id,
        started_at: new Date().toISOString(),
        recognition_confidence: recognitionResult.confidence,
        service_used: recognitionResult.source,
        next_recognition_in: 30
      });

      // Mark as confirmed
      await supabase
        .from('audio_recognition_logs')
        .update({ confirmed: true, now_playing: true })
        .eq('id', logEntry.id);

      return NextResponse.json({
        success: true,
        message: 'Track recognized and automatically confirmed',
        result: {
          ...recognitionResult,
          inCollection: true,
          autoConfirmed: true,
          logId: logEntry.id
        }
      });
    }

    // For lower confidence or non-collection matches, require manual confirmation
    return NextResponse.json({
      success: true,
      message: 'Track recognized, awaiting manual confirmation',
      result: {
        ...recognitionResult,
        inCollection: !!collectionMatch,
        autoConfirmed: false,
        logId: logEntry.id,
        requiresConfirmation: true
      }
    });

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Service test endpoints
export async function OPTIONS() {
  return NextResponse.json({
    services: {
      acrcloud: { status: 'active', endpoint: '/api/test-acrcloud' },
      audd: { status: 'active', endpoint: '/api/test-audd' },
      acoustid: { status: 'error', endpoint: '/api/test-acoustid' }
    }
  });
}