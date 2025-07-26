// src/app/api/audio-recognition/collection/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Collection Match API is available',
    status: 'active'
  });
}