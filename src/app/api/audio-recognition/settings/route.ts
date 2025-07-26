// src/app/api/audio-recognition/settings/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    settings: {
      recognitionThreshold: 0.7,
      maxRetries: 3,
      timeoutMs: 10000,
      enabledServices: ['ACRCloud', 'AudD']
    }
  });
}