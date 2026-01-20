// src/app/api/about-content/route.ts - API route for about page content

import { supabase } from 'lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('about_content')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is fine
      console.error('Error fetching about content:', error);
      return NextResponse.json(
        { error: 'Failed to fetch about content' },
        { status: 500 }
      );
    }

    // Return the data or null if no content exists yet
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching about content:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.main_description && !body.booking_description && !body.contact_name) {
      return NextResponse.json(
        { error: 'At least one content field is required' },
        { status: 400 }
      );
    }

    // Check if content already exists
    const { data: existingData } = await supabase
      .from('about_content')
      .select('id')
      .single();

    let result;
    
    if (existingData) {
      // Update existing record
      result = await supabase
        .from('about_content')
        .update({
          main_description: body.main_description || null,
          booking_description: body.booking_description || null,
          contact_name: body.contact_name || null,
          contact_company: body.contact_company || null,
          contact_email: body.contact_email || null,
          contact_phone: body.contact_phone || null,
          calendly_url: body.calendly_url || null,
          services: body.services || [],
          testimonials: body.testimonials || [],
          booking_notes: body.booking_notes || null,
          amazon_wishlist_url: body.amazon_wishlist_url || null,
          discogs_wantlist_url: body.discogs_wantlist_url || null,
          linktree_url: body.linktree_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id)
        .select()
        .single();
    } else {
      // Insert new record
      result = await supabase
        .from('about_content')
        .insert([{
          main_description: body.main_description || null,
          booking_description: body.booking_description || null,
          contact_name: body.contact_name || null,
          contact_company: body.contact_company || null,
          contact_email: body.contact_email || null,
          contact_phone: body.contact_phone || null,
          calendly_url: body.calendly_url || null,
          services: body.services || [],
          testimonials: body.testimonials || [],
          booking_notes: body.booking_notes || null,
          amazon_wishlist_url: body.amazon_wishlist_url || null,
          discogs_wantlist_url: body.discogs_wantlist_url || null,
          linktree_url: body.linktree_url || null
        }])
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving about content:', result.error);
      return NextResponse.json(
        { error: `Database error: ${result.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    console.error('Unexpected error saving about content:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}

// Handle PUT requests as well (same as POST for this case)
export async function PUT(request: NextRequest) {
  return POST(request);
}