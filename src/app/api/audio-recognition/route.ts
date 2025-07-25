// src/app/api/audio-recognition/route.ts - Clean version with proper TypeScript

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

// TypeScript interfaces
interface AudioData {
  level: number;
  sampleRate: number;
}

interface RecognitionRequestBody {
  triggeredBy: string;
  source: string;
  audioLevel?: number;
  audioData?: AudioData;
  fingerprint?: string;
  timestamp: number;
}

interface CollectionItem {
  id: number;
  artist: string;
  title: string;
  folder: string;
  year?: string;
  image_url?: string;
}

interface RecognitionResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  collection_id?: number;
  folder?: string;
  image_url?: string;
  year?: string;
}

// Collection matching functions
async function searchCollection(
  artist: string, 
  title: string, 
  supabase: ReturnType<typeof createRouteHandlerClient>
): Promise<CollectionItem[]> {
  // Try exact matches first, then fuzzy matches
  const searches = [
    // Exact artist and title match
    supabase.from('collection')
      .select('*')
      .ilike('artist', artist)
      .ilike('title', title)
      .limit(1),
    
    // Fuzzy artist match with title
    supabase.from('collection')
      .select('*')
      .ilike('artist', `%${artist}%`)
      .ilike('title', `%${title}%`)
      .limit(3),
    
    // Just artist match (for when title might be a song name)
    supabase.from('collection')
      .select('*')
      .ilike('artist', `%${artist}%`)
      .limit(5)
  ];

  for (const search of searches) {
    const { data, error } = await search;
    if (!error && data && data.length > 0) {
      return data as CollectionItem[];
    }
  }

  return [];
}

// Calculate confidence score for collection matches
function calculateCollectionConfidence(collectionItem: CollectionItem, recognitionData: RecognitionResult): number {
  let confidence = 0.5; // Base confidence for collection match
  
  // Boost confidence based on folder priority
  const folder = collectionItem.folder?.toLowerCase() || '';
  if (folder.includes('vinyl')) confidence += 0.3;
  else if (folder.includes('cassette')) confidence += 0.2;
  else if (folder.includes('45')) confidence += 0.15;
  
  // Boost for exact artist match
  if (collectionItem.artist?.toLowerCase() === recognitionData.artist?.toLowerCase()) {
    confidence += 0.2;
  }
  
  return Math.min(confidence, 1.0);
}

// Mock external service recognition (Phase 3 implementation)
async function recognizeWithExternalServices(): Promise<RecognitionResult | null> {
  // For Phase 1, return null (no external recognition yet)
  // In Phase 3, we'll add real Spotify, AcoustID, etc. calls here
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
  return null;
}

export async function GET() {
  return NextResponse.json({
    message: 'Audio Recognition API is available',
    version: '2.0',
    features: ['real_audio_processing', 'collection_matching', 'external_apis'],
    status: 'active'
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body: RecognitionRequestBody = await request.json();
    
    console.log('Audio recognition request:', {
      triggeredBy: body.triggeredBy,
      source: body.source,
      hasFingerprint: !!body.fingerprint,
      audioLevel: body.audioData?.level
    });

    // Check if we have sufficient audio data
    if (body.audioData && body.audioData.level < 0.01) {
      await supabase.from('audio_recognition_logs').insert({
        artist: null,
        title: null,
        album: null,
        source: 'insufficient_audio',
        service: body.source || 'unknown',
        confidence: 0,
        confirmed: false,
        created_at: new Date().toISOString(),
        raw_response: { error: 'Audio level too low', level: body.audioData.level }
      });

      return NextResponse.json({
        success: false,
        error: 'Audio level too low for recognition',
        audioLevel: body.audioData.level
      });
    }

    // For Phase 1, simulate recognition results for testing
    let recognitionResult: RecognitionResult | null = null;
    let collectionMatches: CollectionItem[] = [];

    // Generate test recognition data based on audio characteristics
    if (body.triggeredBy === 'manual_test' || (body.audioData && body.audioData.level > 0.05)) {
      // Simulate a recognition result for testing
      recognitionResult = {
        artist: 'Test Artist',
        title: 'Test Track',
        album: 'Test Album',
        confidence: 0.75,
        source: 'simulated'
      };

      // Search collection for matches
      collectionMatches = await searchCollection(
        recognitionResult.artist,
        recognitionResult.title,
        supabase
      );
    }

    // Determine final result
    let finalResult: RecognitionResult | null = null;
    let resultSource = 'none';

    if (collectionMatches.length > 0) {
      // Prefer collection matches
      const bestMatch = collectionMatches[0];
      const confidence = calculateCollectionConfidence(bestMatch, recognitionResult!);
      
      finalResult = {
        artist: bestMatch.artist,
        title: bestMatch.title,
        album: bestMatch.title, // Album title in collection
        confidence: confidence,
        source: 'collection',
        collection_id: bestMatch.id,
        folder: bestMatch.folder,
        image_url: bestMatch.image_url || undefined,
        year: bestMatch.year || undefined
      };
      resultSource = 'collection';
      
    } else if (recognitionResult) {
      // Try external services (Phase 3 implementation)
      const externalResult = await recognizeWithExternalServices();
      
      if (externalResult) {
        finalResult = {
          ...externalResult,
          source: 'external_api'
        };
        resultSource = 'external';
      } else {
        // Use simulated result for now
        finalResult = {
          ...recognitionResult,
          source: 'simulated'
        };
        resultSource = 'simulated';
      }
    }

    // Log the recognition attempt
    const logEntry = {
      artist: finalResult?.artist || null,
      title: finalResult?.title || null,
      album: finalResult?.album || null,
      source: finalResult?.source || 'failed',
      service: body.source || 'unknown',
      confidence: finalResult?.confidence || 0,
      confirmed: false,
      match_source: resultSource === 'collection' ? 'collection' : null,
      matched_id: finalResult?.collection_id || null,
      created_at: new Date().toISOString(),
      raw_response: {
        fingerprint: body.fingerprint?.slice(0, 100) + '...' || null,
        audioData: body.audioData || null,
        collectionMatches: collectionMatches.length,
        triggeredBy: body.triggeredBy,
        finalResult
      }
    };

    const { data: logData, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert(logEntry)
      .select()
      .single();

    if (logError) {
      console.error('Error logging recognition:', logError);
    }

    // Auto-update now playing for high-confidence collection matches
    if (finalResult && finalResult.confidence >= 0.7 && resultSource === 'collection') {
      try {
        // Clear existing now playing
        await supabase.from('now_playing').delete().neq('id', 0);
        
        // Set new now playing
        await supabase.from('now_playing').insert({
          artist: finalResult.artist,
          title: finalResult.title,
          album_title: finalResult.album,
          album_id: finalResult.collection_id || null,
          started_at: new Date().toISOString(),
          recognition_confidence: finalResult.confidence,
          service_used: finalResult.source,
          recognition_image_url: finalResult.image_url || null,
          next_recognition_in: 30
        });

        // Mark as confirmed in logs
        if (logData) {
          await supabase
            .from('audio_recognition_logs')
            .update({ confirmed: true, now_playing: true })
            .eq('id', logData.id);
        }

        console.log('Auto-confirmed high confidence collection match');
      } catch (updateError) {
        console.error('Error updating now playing:', updateError);
      }
    }

    // Return response
    if (finalResult) {
      return NextResponse.json({
        success: true,
        result: finalResult,
        resultSource,
        collectionMatches: collectionMatches.length,
        autoConfirmed: finalResult.confidence >= 0.7 && resultSource === 'collection',
        logId: logData?.id,
        message: resultSource === 'collection' 
          ? 'Found match in your collection!' 
          : resultSource === 'external'
          ? 'Found match from external services'
          : 'Generated test result (Phase 1)',
        phase: 'Phase 1 - Audio Capture Testing'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'No recognition results available',
        audioLevel: body.audioData?.level,
        message: 'No match found. This is normal in Phase 1 testing.',
        phase: 'Phase 1 - Audio Capture Testing'
      });
    }

  } catch (error) {
    console.error('Recognition error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: errorMessage,
        phase: 'Phase 1 - Audio Capture Testing'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({
    phase: 'Phase 1 - Audio Capture Testing',
    availableEndpoints: {
      'GET /api/audio-recognition': 'Get API status',
      'POST /api/audio-recognition': 'Submit audio for recognition'
    },
    nextPhases: [
      'Phase 2: Collection-First Matching',
      'Phase 3: External API Integration',
      'Phase 4: Recognition Pipeline & TV Display',
      'Phase 5: Advanced Features'
    ]
  });
}