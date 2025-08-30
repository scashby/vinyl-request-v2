// Create as: src/app/api/album-suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'src/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      artist,
      album,
      notes,
      contribution_amount,
      suggestor_name,
      suggestor_email,
      context,
      search_query
    } = body;

    // Basic validation
    if (!artist?.trim() || !album?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Artist and album name are required'
      }, { status: 400 });
    }

    // Check if suggestion already exists (to avoid duplicates)
    const { data: existing } = await supabase
      .from('album_suggestions')
      .select('id, suggestion_count')
      .eq('artist', artist.trim())
      .eq('album', album.trim())
      .single();

    let result;
    
    if (existing) {
      // Increment suggestion count for existing suggestion
      result = await supabase
        .from('album_suggestions')
        .update({
          suggestion_count: existing.suggestion_count + 1,
          last_suggested_at: new Date().toISOString(),
          // Update notes if provided
          ...(notes?.trim() && { notes: notes.trim() }),
          // Add contribution amount if provided
          ...(contribution_amount && {
            total_contributions: contribution_amount
          })
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create new suggestion
      result = await supabase
        .from('album_suggestions')
        .insert({
          artist: artist.trim(),
          album: album.trim(),
          notes: notes?.trim() || null,
          contribution_amount: contribution_amount || null,
          total_contributions: contribution_amount || null,
          suggestor_name: suggestor_name?.trim() || 'Anonymous',
          suggestor_email: suggestor_email?.trim() || null,
          context: context || 'general',
          search_query: search_query || null,
          suggestion_count: 1,
          status: 'pending',
          created_at: new Date().toISOString(),
          last_suggested_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: existing ? 
        'Added your vote to existing suggestion!' : 
        'New album suggestion created!'
    });

  } catch (error) {
    console.error('Album suggestion error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit suggestion'
    }, { status: 500 });
  }
}

// GET - Retrieve album suggestions (for admin panel)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('album_suggestions')
      .select('*')
      .order('suggestion_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
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

  } catch (error) {
    console.error('Error fetching album suggestions:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch suggestions'
    }, { status: 500 });
  }
}

// PUT - Update suggestion status (for admin)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Suggestion ID is required'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('album_suggestions')
      .update({
        status: status || 'pending',
        admin_notes: admin_notes || null,
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
      message: 'Suggestion updated successfully'
    });

  } catch (error) {
    console.error('Error updating album suggestion:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update suggestion'
    }, { status: 500 });
  }
}