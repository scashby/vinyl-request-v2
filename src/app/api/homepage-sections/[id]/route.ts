// src/app/api/homepage-sections/[id]/route.ts
// Admin edit endpoint for a single homepage content section.

import { supabase } from 'lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';
import type { Json } from 'types/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid section id' }, { status: 400 });
    }
    const body: { data?: Json; visible?: boolean } = await request.json();

    if (body.data === undefined && body.visible === undefined) {
      return NextResponse.json(
        { error: 'Nothing to update — expected "data" and/or "visible"' },
        { status: 400 }
      );
    }

    const update: { updated_at: string; data?: Json; visible?: boolean } = {
      updated_at: new Date().toISOString(),
    };
    if (body.data !== undefined) update.data = body.data;
    if (body.visible !== undefined) update.visible = body.visible;

    const { data, error } = await supabase
      .from('homepage_sections')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating homepage section:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Unexpected error updating homepage section:', error);
    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
// AUDIT: new for v2 content model.
