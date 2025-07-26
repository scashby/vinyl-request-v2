// src/app/api/audio-recognition/service-test/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate service tests
  const services = [
    { name: 'ACRCloud', status: 'available', latency: '250ms' },
    { name: 'AudD', status: 'available', latency: '300ms' },
    { name: 'AcoustID', status: 'error', error: 'API key not configured' }
  ];

  return NextResponse.json({
    message: 'Service test completed',
    services,
    timestamp: new Date().toISOString()
  });
}
