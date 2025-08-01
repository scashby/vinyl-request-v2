// src/app/api/album-context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AlbumContextRequest {
  artist: string;
  title: string;
  album: string;
  year?: string;
  collectionId?: number;
  source?: string;
}

// GET - Get current album context
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('album_context')
      .select(`
        *,
        collection:collection_id(
          id,
          artist,
          title,
          year,
          image_url,
          folder,
          tracklists
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch album context',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: data || null,
      message: data ? "Album context found" : "No album context set"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST - Set album context
export async function POST(request: NextRequest) {
  try {
    const body: AlbumContextRequest = await request.json();
    const { 
      artist, 
      title, 
      album, 
      year, 
      collectionId, 
      source = 'manual' 
    } = body;
    
    if (!artist || !title || !album) {
      return NextResponse.json({
        success: false,
        error: "Artist, title, and album are required"
      }, { status: 400 });
    }
    
    console.log(`📚 Setting album context: ${artist} - ${album}`);
    
    // Clear existing album context
    await supabase.from('album_context').delete().neq('id', 0);
    
    // Get additional info from collection if collectionId provided
    let collectionInfo = null;
    if (collectionId) {
      const { data: collection } = await supabase
        .from('collection')
        .select('*')
        .eq('id', collectionId)
        .single();
      
      collectionInfo = collection;
    }
    
    // Insert new album context
    const { data, error } = await supabase
      .from('album_context')
      .insert({
        artist,
        title,
        album,
        year: year || collectionInfo?.year || new Date().getFullYear().toString(),
        collection_id: collectionId || null,
        source,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to set album context:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to set album context',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data,
      collectionInfo,
      message: `Album context set: ${artist} - ${album}`,
      source
    });
    
  } catch (error) {
    console.error('Album Context API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT - Update album context
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: "Album context ID is required"
      }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('album_context')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update album context',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data,
      message: "Album context updated"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Clear album context
export async function DELETE() {
  try {
    const { error } = await supabase
      .from('album_context')
      .delete()
      .neq('id', 0); // Delete all records (using neq 0 as a way to delete all)
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to clear album context',
        details: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: "Album context cleared"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}