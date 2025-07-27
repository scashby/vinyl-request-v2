// src/app/api/test-acrcloud/route.ts

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const startTime = Date.now();
  
  const host = process.env.ACRCLOUD_ENDPOINT || 'identify-eu-west-1.acrcloud.com';
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const secretKey = process.env.ACRCLOUD_SECRET_KEY;
  
  if (!accessKey || !secretKey) {
    return NextResponse.json({
      service: 'ACRCloud',
      status: 'error',
      message: 'Missing required environment variables',
      configuration: {
        hasAccessKey: !!accessKey,
        hasSecretKey: !!secretKey,
        endpoint: host
      },
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }

  try {
    // Create a test signature to verify credentials
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `POST\n/v1/identify\n${accessKey}\naudio\n1\n${timestamp}`;
    const signature = crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
    
    // Test with minimal form data
    const formData = new FormData();
    formData.append('access_key', accessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', timestamp.toString());
    
    const response = await fetch(`https://${host}/v1/identify`, {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'DeadWaxDialogues/2.0'
      }
    });
    
    const latency = Date.now() - startTime;
    const data = await response.json();
    
    // ACRCloud returns status code 1001 for "No input" when credentials are valid
    if (data.status?.code === 1001) {
      return NextResponse.json({
        service: 'ACRCloud',
        status: 'success',
        message: 'Service available and credentials valid',
        latency: `${latency}ms`,
        configuration: {
          endpoint: host,
          credentialsValid: true,
          signatureWorking: true
        },
        testResponse: data,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      service: 'ACRCloud',
      status: 'error',
      message: data.status?.msg || 'Unexpected response',
      latency: `${latency}ms`,
      testResponse: data,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
  } catch (error) {
    return NextResponse.json({
      service: 'ACRCloud',
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed',
      latency: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}