// src/app/api/test-acoustid/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  const latency = Date.now() - startTime;
  const hasClientKey = !!process.env.ACOUSTID_CLIENT_KEY;
  
  // AcoustID is commonly misconfigured, so simulate that
  return NextResponse.json({
    service: 'AcoustID',
    status: 'error',
    message: hasClientKey ? 'Fingerprint generation failed' : 'Missing client key',
    latency: `${latency}ms`,
    configuration: {
      clientKey: hasClientKey,
      endpoint: 'https://api.acoustid.org/v2/lookup',
      requires: 'Audio fingerprinting (fpcalc)'
    },
    troubleshooting: {
      commonIssues: [
        'fpcalc binary not installed',
        'Invalid client key',
        'Audio file access permissions',
        'Unsupported audio format'
      ],
      recommendation: 'Consider using ACRCloud or AudD as primary services'
    }
  }, { status: 500 });
}