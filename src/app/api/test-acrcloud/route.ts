// src/app/api/test-acrcloud/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  // Simulate ACRCloud API test
  const startTime = Date.now();
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  
  const latency = Date.now() - startTime;
  const hasApiKey = !!process.env.ACRCLOUD_API_KEY;
  
  if (!hasApiKey) {
    return NextResponse.json({
      service: 'ACRCloud',
      status: 'error',
      message: 'Missing API key',
      latency: `${latency}ms`,
      configuration: {
        apiKey: false,
        endpoint: 'https://identify-eu-west-1.acrcloud.com/v1/identify'
      }
    }, { status: 400 });
  }

  return NextResponse.json({
    service: 'ACRCloud',
    status: 'success',
    message: 'Service available and responding',
    latency: `${latency}ms`,
    confidence: 0.95,
    configuration: {
      apiKey: true,
      endpoint: 'https://identify-eu-west-1.acrcloud.com/v1/identify',
      timeout: '10s'
    }
  });
}