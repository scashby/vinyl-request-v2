// src/app/api/dj-sets/route.ts
// API endpoint for DJ sets management and future live streaming

import { supabase } from 'src/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const recent = searchParams.get('recent') === 'true';

    let query = supabase
      .from('dj_sets')
      .select(`
        *,
        events(title, date, location),
        inventory:inventory_id (
          id,
          release:releases (
            id,
            release_year,
            media_type,
            format_details,
            qty,
            master:masters (
              id,
              title,
              cover_image_url,
              artist:artists (id, name)
            )
          )
        )
      `)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    // Filter by event if specified
    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    // Filter for recent sets (last 30 days)
    if (recent) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('recorded_at', thirtyDaysAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });

  } catch (error: unknown) {
    console.error('Error fetching DJ sets:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      event_id,
      inventory_id,
      file_url,
      file_size,
      duration,
      recorded_at,
      tags,
      track_listing,
      is_live
    } = body;

    // Basic validation
    if (!title || !file_url) {
      return NextResponse.json({
        success: false,
        error: 'Title and file URL are required'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('dj_sets')
      .insert({
        title,
        description,
        event_id: event_id || null,
        inventory_id: inventory_id || null,
        file_url,
        file_size: file_size || null,
        duration: duration || null,
        recorded_at: recorded_at || new Date().toISOString(),
        tags: tags || [],
        track_listing: track_listing || [],
        is_live: is_live || false
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'DJ set created successfully'
    });

  } catch (error: unknown) {
    console.error('Error creating DJ set:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'DJ set ID is required'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('dj_sets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'DJ set updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating DJ set:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'DJ set ID is required'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('dj_sets')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'DJ set deleted successfully'
    });

  } catch (error: unknown) {
    console.error('Error deleting DJ set:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// Future: Live streaming endpoint
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, eventId } = body;

    if (action === 'start_live_stream') {
      // Future implementation for live streaming
      // This would integrate with your Reloop Tape's live output
      
      // For now, create a placeholder "live" entry
      const { data, error } = await supabase
        .from('dj_sets')
        .insert({
          title: 'Live Stream - ' + new Date().toLocaleString(),
          description: 'Live audio stream in progress',
          event_id: eventId || null,
          file_url: '/api/live-stream', // Future: actual stream URL
          is_live: true,
          recorded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data,
        message: 'Live stream started',
        stream_url: '/api/live-stream'
      });
    }

    if (action === 'stop_live_stream') {
      // Stop live stream and optionally convert to recorded set
      const { data, error } = await supabase
        .from('dj_sets')
        .update({ is_live: false })
        .eq('is_live', true)
        .select();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Live stream stopped',
        converted_sets: data?.length || 0
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error: unknown) {
    console.error('Error handling live stream action:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
