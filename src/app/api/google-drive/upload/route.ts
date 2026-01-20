// src/app/api/google-drive/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || file?.name;
    const folderId = (formData.get('folder_id') as string) || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Initialize Google Drive
    const drive = await initGoogleDrive();

    // Upload to Google Drive
    // @ts-ignore - ReadableStream types compatibility issue
    const response = await drive.files.create({
      requestBody: {
        name: name,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: file.type,
        body: buffer, // drive.files.create supports Buffer
      },
      fields: 'id,name,webViewLink,webContentLink,size',
    });

    // Make file publicly accessible
    if (response.data.id) {
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
    } else {
        throw new Error("Upload failed: No ID returned");
    }

  } catch (error: any) {
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