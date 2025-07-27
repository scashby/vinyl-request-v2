// src/app/api/test-audd/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();
  
  const apiToken = process.env.AUDD_API_TOKEN;
  
  if (!apiToken) {
    return NextResponse.json({
      service: 'AudD',
      status: 'error',
      message: 'Missing AUDD_API_TOKEN environment variable',
      configuration: {
        hasApiToken: false,
        endpoint: 'https://api.audd.io/'
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  try {
    // Test API token validity with usage endpoint
    const formData = new FormData();
    formData.append('api_token', apiToken);
    formData.append('method', 'usage');
    
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return NextResponse.json({
        service: 'AudD',
        status: 'error',
        message: `HTTP ${response.status}: ${response.statusText}`,
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      }, { status: response.status });
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return NextResponse.json({
        service: 'AudD',
        status: 'success',
        message: 'Service available and API token valid',
        latency: `${latency}ms`,
        configuration: {
          endpoint: 'https://api.audd.io/',
          tokenValid: true
        },
        usage: data.result,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        service: 'AudD',
        status: 'error',
        message: data.error?.error_message || 'Invalid API token',
        latency: `${latency}ms`,
        testResponse: data,
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
  } catch (error) {
    return NextResponse.json({
      service: 'AudD',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}