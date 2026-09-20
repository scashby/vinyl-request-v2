// src/app/api/homepage-sections/route.ts
// Section-based content for the homepage (and, later, other pages). See
// sql/create-homepage-sections.sql for the shape/rationale.

import { supabase } from 'lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const page = request.nextUrl.searchParams.get('page') || 'home';

    const { data, error } = await supabase
      .from('homepage_sections')
      .select('*')
      .eq('page', page)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching homepage sections:', error);
      return NextResponse.json(
        { error: 'Failed to fetch homepage sections' },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching homepage sections:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
// AUDIT: new for v2 content model.
