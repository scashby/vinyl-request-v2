// src/app/api/google-drive/finalize-upload/route.js
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
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }

    // Initialize Google Drive
    const drive = await initGoogleDrive();

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get updated file info with public links
    const fileInfo = await drive.files.get({
      fileId: fileId,
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
    console.error('Finalize upload error:', error);
    return NextResponse.json(
      { error: 'Failed to finalize upload', details: error.message },
      { status: 500 }
    );
  }
}