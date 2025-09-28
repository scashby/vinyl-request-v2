// src/app/api/google-drive/delete/[fileId]/route.js
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

export async function DELETE(request, { params }) {
  try {
    const { fileId } = params;

    if (!fileId) {
      return NextResponse.json({ error: 'No file ID provided' }, { status: 400 });
    }

    // Initialize Google Drive
    const drive = await initGoogleDrive();

    // Delete the file
    await drive.files.delete({
      fileId: fileId,
    });

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });

  } catch (error) {
    console.error('Google Drive delete error:', error);
    
    // Handle file not found
    if (error.code === 404) {
      return NextResponse.json({
        success: true,
        message: 'File already deleted or not found',
      });
    }

    return NextResponse.json(
      { error: 'Delete failed', details: error.message },
      { status: 500 }
    );
  }
}