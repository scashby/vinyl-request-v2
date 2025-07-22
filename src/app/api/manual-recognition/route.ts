// src/app/api/manual-recognition/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

export async function GET() {
  return NextResponse.json({
    message: 'Manual Recognition API is available',
    endpoints: {
      setNowPlaying: 'POST /api/manual-recognition',
      clearNowPlaying: 'DELETE /api/manual-recognition'
    },
    status: 'active'
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const body = await request.json();
    
    const { artist, title, album_title, album_id } = body;
    
    if (!artist || !title) {
      return NextResponse.json(
        { error: 'Artist and title are required' },
        { status: 400 }
      );
    }

    // Clear existing now playing
    await supabase.from('now_playing').delete().neq('id', 0);
    
    // Set new now playing
    const { data, error } = await supabase.from('now_playing').insert({
      artist,
      title,
      album_title,
      album_id: album_id ? parseInt(album_id) : null,
      started_at: new Date().toISOString(),
      recognition_confidence: 1.0,
      service_used: 'manual_override',
      updated_at: new Date().toISOString(),
      next_recognition_in: 30
    }).select().single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Now playing updated successfully',
      data
    });

  } catch (error) {
    console.error('Manual recognition error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Clear now playing
    const { error } = await supabase
      .from('now_playing')
      .update({
        artist: null,
        title: null,
        album_title: null,
        album_id: null,
        recognition_image_url: null,
        updated_at: new Date().toISOString(),
        next_recognition_in: 30
      })
      .eq('id', 1);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Now playing cleared successfully'
    });

  } catch (error) {
    console.error('Clear now playing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}