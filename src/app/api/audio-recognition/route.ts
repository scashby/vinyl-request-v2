// src/app/api/audio-recognition/route.ts - Fixed TypeScript implementation

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

// Fixed interfaces with proper typing
interface RecognitionResult {
  success: boolean;
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  error?: string;
}

interface CollectionItem {
  id: number;
  artist: string;
  title: string;
  album?: string;
  year?: string;
  image_url?: string;
  folder?: string;
}

// Mock recognition services for testing with proper typing
const mockRecognitionServices = {
  acrcloud: async (): Promise<RecognitionResult> => ({
    success: true,
    artist: 'The Beatles',
    title: 'Hey Jude',
    album: 'The Beatles 1967-1970',
    confidence: 0.95,
    source: 'ACRCloud'
  }),
  audd: async (): Promise<RecognitionResult> => ({
    success: true,
    artist: 'Pink Floyd',
    title: 'Wish You Were Here',
    album: 'Wish You Were Here',
    confidence: 0.88,
    source: 'AudD'
  }),
  acoustid: async (): Promise<RecognitionResult> => ({
    success: false,
    artist: '',
    title: '',
    album: '',
    confidence: 0,
    source: 'AcoustID',
    error: 'API key invalid'
  })
};

// Simulate actual recognition workflow
async function simulateRecognition(): Promise<RecognitionResult | null> {
  // Try services in priority order
  const services: (keyof typeof mockRecognitionServices)[] = ['acrcloud', 'audd', 'acoustid'];
  
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
    status: 'active',
    enabledServices: ['ACRCloud', 'AudD'] // Mock enabled services
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body = await request.json();
    
    console.log('Audio recognition triggered:', body);

    // Handle different types of recognition requests
    const { audioData, triggeredBy, timestamp } = body;

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
        raw_response: { error: 'All services failed', triggeredBy, timestamp }
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

    // Check if this track is in our collection with proper typing
    const { data: collectionData } = await supabase
      .from('collection')
      .select('id, artist, title, year, image_url, folder')
      .ilike('artist', `%${recognitionResult.artist}%`)
      .ilike('title', `%${recognitionResult.title}%`)
      .limit(1);

    // Fixed type conversion - properly type the collection match
    const collectionMatch: CollectionItem | null = collectionData && collectionData.length > 0 
      ? {
          id: collectionData[0].id,
          artist: collectionData[0].artist,
          title: collectionData[0].title,
          year: collectionData[0].year || undefined,
          image_url: collectionData[0].image_url || undefined,
          folder: collectionData[0].folder || undefined
        }
      : null;

    // Log the recognition with proper error handling
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
        raw_response: {
          ...recognitionResult,
          triggeredBy,
          timestamp,
          audioDataReceived: !!audioData
        }
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
      // Update now playing with proper error handling
      const { error: deleteError } = await supabase.from('now_playing').delete().neq('id', 0);
      if (deleteError) {
        console.warn('Error clearing now playing:', deleteError);
      }

      const { error: insertError } = await supabase.from('now_playing').insert({
        artist: recognitionResult.artist,
        title: recognitionResult.title,
        album_title: recognitionResult.album,
        album_id: collectionMatch.id,
        started_at: new Date().toISOString(),
        recognition_confidence: recognitionResult.confidence,
        service_used: recognitionResult.source,
        next_recognition_in: 30,
        updated_at: new Date().toISOString()
      });

      if (insertError) {
        console.error('Error setting now playing:', insertError);
      }

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
          logId: logEntry.id,
          collectionMatch
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
        requiresConfirmation: true,
        collectionMatch
      }
    });

  } catch (error) {
    console.error('Recognition error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: errorMessage 
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
    },
    supportedMimeTypes: [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav'
    ],
    maxDuration: 30, // seconds
    sampleRate: 44100
  });
}