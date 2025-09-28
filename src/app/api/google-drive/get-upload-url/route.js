// src/app/api/google-drive/get-upload-url/route.js
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const initGoogleDrive = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });
  return drive;
};

export async function POST(request) {
  try {
    const { fileName, mimeType } = await request.json();

    // Initialize Google Drive
    const drive = await initGoogleDrive();

    // Create a resumable upload session
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
      },
      media: {
        mimeType: mimeType,
        body: '', // Empty body for resumable upload
      },
      uploadType: 'resumable',
      fields: 'id,name,webViewLink,webContentLink',
    });

    // Get the upload URL from the response headers
    const uploadUrl = response.headers['location'];

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileId: response.data.id,
    });

  } catch (error) {
    console.error('Upload URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL', details: error.message },
      { status: 500 }
    );
  }
}