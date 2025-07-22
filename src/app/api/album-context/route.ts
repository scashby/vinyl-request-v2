// src/app/api/album-context/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from 'types/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const { searchParams } = new URL(request.url);
    
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
      .from('album_context')
      .select('*')
      .limit(limit);

    if (artist) {
      query = query.ilike('artist', `%${artist}%`);
    }
    if (title) {
      query = query.ilike('title', `%${title}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Album Context API is available',
      data,
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Album context API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}