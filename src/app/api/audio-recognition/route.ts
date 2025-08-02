// src/app/api/audio-recognition/route.ts
// TEMPORARY FIX for Phase 1 - Full implementation in Phase 2

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RecognitionRequest {
  audioData: string;
  triggeredBy?: string;
  timestamp?: string;
}

interface SimulationResult {
  artist: string;
  title: string;
  album: string;
  confidence: number;
  source: string;
  service: string;
  image_url: string;
}

// TEMPORARY: Simple simulation for Phase 1 cleanup
async function temporarySimulation(): Promise<SimulationResult | null> {
  console.log('⚠️ TEMPORARY: Using basic simulation during Phase 1 cleanup');
  
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
  
  const scenarios: SimulationResult[] = [
    {
      artist: "The Beatles",
      title: "Come Together", 
      album: "Abbey Road",
      confidence: 0.95,
      source: "temp_simulation",
      service: "Phase1_Cleanup_Mode",
      image_url: "https://upload.wikimedia.org/wikipedia/en/4/42/Beatles_-_Abbey_Road.jpg"
    },
    {
      artist: "Pink Floyd",
      title: "Time",
      album: "The Dark Side of the Moon", 
      confidence: 0.88,
      source: "temp_simulation",
      service: "Phase1_Cleanup_Mode",
      image_url: "https://upload.wikimedia.org/wikipedia/en/3/3b/Dark_Side_of_the_Moon.png"
    }
  ];
  
  // 70% success rate during cleanup
  if (Math.random() > 0.3) {
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }
  
  return null;
}

// GET - Return service status
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "TEMPORARY: Audio Recognition API in Phase 1 cleanup mode",
    mode: "phase1_cleanup_temp",
    status: "⚠️ Limited functionality during simplification",
    enabledServices: ["Temporary Simulation"],
    note: "Full multi-source recognition will be implemented in Phase 2",
    version: "1.0.0-phase1-temp"
  });
}

// POST - Temporary recognition endpoint
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: RecognitionRequest = await request.json();
    const { audioData, triggeredBy = 'manual', timestamp } = body;
    
    if (!audioData) {
      return NextResponse.json({
        success: false,
        error: "No audio data provided"
      }, { status: 400 });
    }
    
    console.log(`🎵 TEMPORARY: Processing recognition in Phase 1 cleanup mode (${triggeredBy})`);
    
    // Use temporary simulation
    const result = await temporarySimulation();
    const processingTime = Date.now() - startTime;
    
    if (!result) {
      // Log failed recognition
      await supabase.from('audio_recognition_logs').insert({
        artist: null,
        title: null,
        album: null,
        source: 'temp_simulation',
        service: 'phase1_cleanup',
        confidence: 0,
        confirmed: false,
        match_source: null,
        now_playing: false,
        raw_response: { 
          error: 'No match found in temp mode', 
          triggered_by: triggeredBy,
          mode: 'phase1_cleanup',
          processing_time: processingTime
        },
        created_at: new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        error: "No match found (Phase 1 cleanup mode)",
        processingTime,
        mode: "phase1_cleanup_temp",
        details: "Temporary simulation during system simplification"
      });
    }
    
    // Log successful recognition
    const { data: logData, error: logError } = await supabase
      .from('audio_recognition_logs')
      .insert({
        artist: result.artist,
        title: result.title,
        album: result.album,
        source: result.source,
        service: result.service,
        confidence: result.confidence,
        confirmed: false,
        match_source: 'temp_simulation',
        now_playing: false,
        raw_response: { 
          ...result, 
          triggered_by: triggeredBy, 
          processing_time: processingTime,
          mode: 'phase1_cleanup'
        },
        created_at: new Date().toISOString(),
        timestamp: timestamp || new Date().toISOString()
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Failed to log recognition:', logError);
    } else {
      console.log(`✅ Recognition logged with ID: ${logData?.id}`);
    }
    
    // Update now playing
    const { error: nowPlayingError } = await supabase
      .from('now_playing')
      .upsert({
        id: 1,
        artist: result.artist,
        title: result.title,
        album_title: result.album,
        recognition_image_url: result.image_url,
        album_id: null,
        started_at: new Date().toISOString(),
        recognition_confidence: result.confidence,
        service_used: result.service,
        next_recognition_in: 30,
        updated_at: new Date().toISOString()
      });
    
    if (nowPlayingError) {
      console.error('Failed to update now playing:', nowPlayingError);
    } else {
      console.log('✅ Now playing updated (temp mode)');
    }
    
    return NextResponse.json({
      success: true,
      result: {
        ...result,
        processingTime
      },
      processingTime,
      logId: logData?.id,
      triggeredBy,
      mode: "phase1_cleanup_temp",
      message: `TEMPORARY: Simulated recognition: ${result.artist} - ${result.title}`,
      note: "Full recognition will be available after Phase 2 completion"
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Temporary Recognition API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
      mode: "phase1_cleanup_temp",
      details: "Error during Phase 1 cleanup mode"
    }, { status: 500 });
  }
}