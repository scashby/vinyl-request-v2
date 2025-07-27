// src/app/api/audio-recognition/service-test/route.ts - Real Service Tests

import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 Starting real service connectivity tests...');
  
  const results = [];
  
  // Test ACRCloud
  try {
    const acrResult = await testACRCloud();
    results.push(acrResult);
  } catch (error) {
    results.push({
      service: 'ACRCloud',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
  
  // Test AudD
  try {
    const auddResult = await testAudD();
    results.push(auddResult);
  } catch (error) {
    results.push({
      service: 'AudD',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
  
  // Test AcoustID
  try {
    const acoustidResult = await testAcoustID();
    results.push(acoustidResult);
  } catch (error) {
    results.push({
      service: 'AcoustID',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
  
  const successCount = results.filter(r => r.status === 'available').length;
  
  return NextResponse.json({
    message: `Service tests completed: ${successCount}/${results.length} services available`,
    results,
    summary: {
      total: results.length,
      available: successCount,
      errors: results.length - successCount
    },
    timestamp: new Date().toISOString()
  });
}

async function testACRCloud() {
  const startTime = Date.now();
  
  const host = process.env.ACRCLOUD_ENDPOINT;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const secretKey = process.env.ACRCLOUD_SECRET_KEY;
  
  if (!accessKey || !secretKey || !host) {
    return {
      service: 'ACRCloud',
      status: 'error',
      error: 'Missing environment variables (ACRCLOUD_ACCESS_KEY, ACRCLOUD_SECRET_KEY, ACRCLOUD_ENDPOINT)',
      configuration: {
        hasAccessKey: !!accessKey,
        hasSecretKey: !!secretKey,
        hasEndpoint: !!host,
        endpoint: host || 'not configured'
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    // Test with a minimal request to check connectivity
    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      },
      body: new FormData(), // Empty form data to test endpoint
    });
    
    const latency = Date.now() - startTime;
    
    // ACRCloud should return a specific error for invalid requests
    if (response.status === 400) {
      const data = await response.json();
      if (data.status && data.status.code === 1001) {
        // This is the expected "No input" error, meaning the service is reachable
        return {
          service: 'ACRCloud',
          status: 'available',
          message: 'Service reachable and responding correctly',
          configuration: {
            endpoint: host,
            hasCredentials: true
          },
          latency: `${latency}ms`,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return {
      service: 'ACRCloud',
      status: 'error',
      error: `Unexpected response: HTTP ${response.status}`,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      service: 'ACRCloud',
      status: 'error',
      error: error instanceof Error ? error.message : 'Network error',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
}

async function testAudD() {
  const startTime = Date.now();
  
  const apiToken = process.env.AUDD_API_TOKEN;
  
  if (!apiToken) {
    return {
      service: 'AudD',
      status: 'error',
      error: 'Missing AUDD_API_TOKEN environment variable',
      configuration: {
        hasApiToken: false,
        endpoint: 'https://api.audd.io/'
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    // Test with a simple API call to check token validity
    const formData = new FormData();
    formData.append('api_token', apiToken);
    formData.append('method', 'usage'); // Check API usage/limits
    
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        service: 'AudD',
        status: 'error',
        error: `HTTP ${response.status}: ${response.statusText}`,
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    }
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        service: 'AudD',
        status: 'available',
        message: 'Service available and API token valid',
        configuration: {
          endpoint: 'https://api.audd.io/',
          hasApiToken: true
        },
        usage: data.result || 'Usage data unavailable',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        service: 'AudD',
        status: 'error',
        error: data.error?.error_message || 'Invalid API token or service error',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    return {
      service: 'AudD',
      status: 'error',
      error: error instanceof Error ? error.message : 'Network error',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
}

async function testAcoustID() {
  const startTime = Date.now();
  
  const clientKey = process.env.ACOUSTID_CLIENT_KEY;
  
  if (!clientKey) {
    return {
      service: 'AcoustID',
      status: 'error',
      error: 'Missing ACOUSTID_CLIENT_KEY environment variable',
      configuration: {
        hasClientKey: false,
        endpoint: 'https://api.acoustid.org/v2/lookup'
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    // Test with a minimal request to check API connectivity
    const testUrl = new URL('https://api.acoustid.org/v2/lookup');
    testUrl.searchParams.append('client', clientKey);
    testUrl.searchParams.append('meta', 'recordings');
    // Note: We're not providing fingerprint/duration, which should give us a specific error
    
    const response = await fetch(testUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      
      // AcoustID should return an error for missing parameters
      if (data.status === 'error' && data.error && data.error.code === 2) {
        // Error code 2 means "missing parameters" - this is expected and confirms the API is working
        return {
          service: 'AcoustID',
          status: 'available',
          message: 'Service reachable and client key valid',
          configuration: {
            endpoint: 'https://api.acoustid.org/v2/lookup',
            hasClientKey: true
          },
          note: 'Fingerprint generation required for actual recognition',
          latency: `${latency}ms`,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return {
      service: 'AcoustID',
      status: 'error',
      error: `Unexpected response: HTTP ${response.status}`,
      latency: `${latency}ms`,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      service: 'AcoustID',
      status: 'error',
      error: error instanceof Error ? error.message : 'Network error',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
}