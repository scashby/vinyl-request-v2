// src/app/api/audio-recognition/override/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Manual Override API is available',
    status: 'active'
  });
}

export async function POST() {
  return NextResponse.json({
    message: 'Override applied successfully',
    status: 'success'
  });
}