// src/app/api/test-acoustid/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();
  
  const clientKey = process.env.ACOUSTID_CLIENT_KEY;
  
  if (!clientKey) {
    return NextResponse.json({
      service: 'AcoustID',
      status: 'error',
      message: 'Missing ACOUSTID_CLIENT_KEY environment variable',
      configuration: {
        hasClientKey: false,
        endpoint: 'https://api.acoustid.org/v2/lookup'
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  try {
    // Test client key validity
    const testUrl = new URL('https://api.acoustid.org/v2/lookup');
    testUrl.searchParams.append('client', clientKey);
    testUrl.searchParams.append('meta', 'recordings');
    // Intentionally omit fingerprint to get a specific error response
    
    const response = await fetch(testUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      // AcoustID returns error code 2 for missing required parameters when client key is valid
      if (data.status === 'error' && data.error?.code === 2) {
        return NextResponse.json({
          service: 'AcoustID',
          status: 'success',
          message: 'Service available and client key valid',
          latency: `${latency}ms`,
          configuration: {
            endpoint: 'https://api.acoustid.org/v2/lookup',
            clientKeyValid: true
          },
          note: 'Audio fingerprinting required for actual recognition',
          testResponse: data,
          timestamp: new Date().toISOString()
        });
      } else if (data.status === 'error' && data.error?.code === 1) {
        return NextResponse.json({
          service: 'AcoustID',
          status: 'error',
          message: 'Invalid client key',
          latency: `${latency}ms`,
          testResponse: data,
          timestamp: new Date().toISOString()
        }, { status: 401 });
      }
    }
    
    return NextResponse.json({
      service: 'AcoustID',
      status: 'error',
      message: `Unexpected response: HTTP ${response.status}`,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
  } catch (error) {
    return NextResponse.json({
      service: 'AcoustID',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}