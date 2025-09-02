// Fixed Album Suggestions API Route with TypeScript error resolution
// Replace: src/app/api/album-suggestions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'src/lib/supabaseClient';

// Enable detailed logging
const DEBUG = true;

function debugLog(message: string, data?: unknown) {
  if (DEBUG) {
    console.log(`[Album Suggestions API] ${message}`, data || '');
  }
}

export async function POST(request: NextRequest) {
  debugLog('POST request received');
  
  try {
    let body;
    try {
      body = await request.json();
      debugLog('Request body parsed:', body);
    } catch (parseError) {
      debugLog('Failed to parse request body:', parseError);
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

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

    debugLog('Extracted fields:', {
      artist: artist?.substring(0, 20),
      album: album?.substring(0, 20),
      context,
      search_query: search_query?.substring(0, 20)
    });

    // Basic validation
    if (!artist?.trim() || !album?.trim()) {
      debugLog('Validation failed: Missing artist or album');
      return NextResponse.json({
        success: false,
        error: 'Artist and album name are required'
      }, { status: 400 });
    }

    debugLog('Attempting to check for existing suggestion');
    
    // Check if suggestion already exists (to avoid duplicates)
    const { data: existing, error: existingError } = await supabase
      .from('album_suggestions')
      .select('id, contribution_amount')
      .eq('artist', artist.trim())
      .eq('album', album.trim())
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      debugLog('Error checking existing suggestion:', existingError);
      return NextResponse.json({
        success: false,
        error: `Database error: ${existingError.message}`
      }, { status: 500 });
    }

    // Define proper types for album suggestion (matching actual database schema)
    interface AlbumSuggestion {
      id: number;
      artist: string;
      album: string;
      reason: string | null;
      contributor_name: string | null;
      contributor_email: string | null;
      contribution_amount: string | null;
      context: string;
      status: string;
      created_at: string;
      updated_at?: string | null;
      admin_notes?: string | null;
      estimated_cost?: number | null;
      venmo_transaction_id?: string | null;
      priority_score?: number | null;
    }

    // Declare result variable with proper type
    let result: { data: AlbumSuggestion | null; error: Error | null };
    
    if (existing) {
      debugLog('Found existing suggestion, updating:', existing.id);
      
      // Just update the record with new notes if provided - don't try to sum contributions
      // since contribution_amount in the schema is text, not numeric
      const { data: updateData, error } = await supabase
        .from('album_suggestions')
        .update({
          updated_at: new Date().toISOString(),
          // Update reason if provided
          ...(notes?.trim() && { reason: notes.trim() }),
          // Update contribution amount if provided
          ...(contribution_amount && {
            contribution_amount: contribution_amount.toString()
          })
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        debugLog('Error updating existing suggestion:', error);
        throw new Error(`Failed to update existing suggestion: ${error.message}`);
      }

      result = { data: updateData, error: null };
      debugLog('Successfully updated existing suggestion');
    } else {
      debugLog('Creating new suggestion');
      
      // Create new suggestion
      const insertData = {
        artist: artist.trim(),
        album: album.trim(),
        reason: notes?.trim() || null,
        contribution_amount: contribution_amount ? contribution_amount.toString() : null,
        contributor_name: suggestor_name?.trim() || 'Anonymous',
        contributor_email: suggestor_email?.trim() || null,
        context: context || 'general',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      debugLog('Insert data prepared:', insertData);

      const { data: insertedData, error } = await supabase
        .from('album_suggestions')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        debugLog('Error creating new suggestion:', error);
        throw new Error(`Failed to create suggestion: ${error.message}`);
      }

      result = { data: insertedData, error: null };
      debugLog('Successfully created new suggestion');
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    const responseData = {
      success: true,
      data: result.data,
      message: existing ? 
        'Added your vote to existing suggestion!' : 
        'New album suggestion created!'
    };

    debugLog('Sending success response:', responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to submit suggestion';
    debugLog('Caught error:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      debug: DEBUG ? {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      } : undefined
    }, { status: 500 });
  }
}

// GET - Retrieve album suggestions (for admin panel)
export async function GET(request: NextRequest) {
  debugLog('GET request received');
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    debugLog('GET parameters:', { status, limit });

    let query = supabase
      .from('album_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      debugLog('Error fetching suggestions:', error);
      throw error;
    }

    debugLog(`Successfully fetched ${data?.length || 0} suggestions`);

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch suggestions';
    debugLog('GET error:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// PUT - Update suggestion status (for admin)
export async function PUT(request: NextRequest) {
  debugLog('PUT request received');
  
  try {
    const body = await request.json();
    const { id, status, admin_notes } = body;

    debugLog('PUT body:', { id, status, admin_notes: admin_notes ? 'present' : 'none' });

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
      debugLog('PUT error:', error);
      throw error;
    }

    debugLog('Successfully updated suggestion');

    return NextResponse.json({
      success: true,
      data,
      message: 'Suggestion updated successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update suggestion';
    debugLog('PUT error:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

// DELETE - Remove suggestion (for admin)
export async function DELETE(request: NextRequest) {
  debugLog('DELETE request received');
  
  try {
    const body = await request.json();
    const { id } = body;

    debugLog('DELETE body:', { id });

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Suggestion ID is required'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('album_suggestions')
      .delete()
      .eq('id', id);

    if (error) {
      debugLog('DELETE error:', error);
      throw error;
    }

    debugLog('Successfully deleted suggestion');

    return NextResponse.json({
      success: true,
      message: 'Suggestion deleted successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete suggestion';
    debugLog('DELETE error:', error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}