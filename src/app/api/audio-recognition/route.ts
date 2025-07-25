// src/app/api/audio-recognition/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { RecognitionEngine, ProcessingResult } from 'lib/audio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioData, options } = body;

    if (!audioData || !Array.isArray(audioData)) {
      return NextResponse.json(
        { error: 'Invalid audio data format' },
        { status: 400 }
      );
    }

    // Convert array back to Float32Array
    const audioBuffer = new Float32Array(audioData);
    
    // Initialize recognition engine with options if provided
    const recognitionEngine = new RecognitionEngine(undefined, options);
    
    // Process the audio
    const result: ProcessingResult = await recognitionEngine.processAudio(audioBuffer);

    if (result.success) {
      return NextResponse.json({ 
        success: true,
        result: result.result,
        processingTime: result.processingTime
      });
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error,
          processingTime: result.processingTime
        },
        { status: 500 }
      );
    }

  } catch (err) {
    console.error('Audio recognition API error:', err);
    
    return NextResponse.json(
      { 
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Audio Recognition API',
    endpoints: {
      POST: 'Process audio data for recognition'
    },
    version: '1.0.0'
  });
}