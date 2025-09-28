// src/app/api/google-drive/upload/route.js
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Initialize Google Drive client
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
    const formData = await request.formData();
    const file = formData.get('file');
    const name = formData.get('name') || file.name;
    const folderId = formData.get('folder_id') || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Initialize Google Drive
    const drive = await initGoogleDrive();

    // Upload to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: name,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: file.type,
        body: buffer,
      },
      fields: 'id,name,webViewLink,webContentLink,size',
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get updated file info with public links
    const fileInfo = await drive.files.get({
      fileId: response.data.id,
      fields: 'id,name,webViewLink,webContentLink,size,createdTime',
    });

    return NextResponse.json({
      success: true,
      id: fileInfo.data.id,
      name: fileInfo.data.name,
      webViewLink: fileInfo.data.webViewLink,
      webContentLink: fileInfo.data.webContentLink,
      size: fileInfo.data.size,
      createdTime: fileInfo.data.createdTime,
    });

  } catch (error) {
    console.error('Google Drive upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle CORS for browser uploads
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}