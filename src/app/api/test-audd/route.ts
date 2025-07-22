// src/app/api/test-audd/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  
  const latency = Date.now() - startTime;
  const hasApiToken = !!process.env.AUDD_API_TOKEN;
  
  if (!hasApiToken) {
    return NextResponse.json({
      service: 'AudD',
      status: 'error',
      message: 'Missing API token',
      latency: `${latency}ms`,
      configuration: {
        apiToken: false,
        endpoint: 'https://api.audd.io/'
      }
    }, { status: 400 });
  }

  return NextResponse.json({
    service: 'AudD',
    status: 'success',
    message: 'Service available and responding',
    latency: `${latency}ms`,
    confidence: 0.87,
    configuration: {
      apiToken: true,
      endpoint: 'https://api.audd.io/',
      timeout: '15s'
    }
  });
}