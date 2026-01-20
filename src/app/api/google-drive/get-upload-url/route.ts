// src/app/api/google-drive/get-upload-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const initGoogleDrive = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return auth;
};

export async function POST(request: NextRequest) {
  try {
    const { fileName, mimeType } = await request.json();

    // Get authentication
    const auth = await initGoogleDrive();
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    // Create resumable upload session with Google Drive API
    const metadata = {
      name: fileName,
      parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
    };

    const initResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType,
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`Failed to initiate upload: ${initResponse.status} ${errorText}`);
    }

    // Get the resumable upload URL from the Location header
    const uploadUrl = initResponse.headers.get('location');

    if (!uploadUrl) {
      throw new Error('No upload URL returned from Google Drive');
    }

    return NextResponse.json({
      success: true,
      uploadUrl,
      accessToken: accessToken.token, // Need this for the actual upload
    });

  } catch (error: unknown) {
    console.error('Upload URL generation error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate upload URL', details: msg },
      { status: 500 }
    );
  }
}