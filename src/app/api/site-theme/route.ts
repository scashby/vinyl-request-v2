// src/app/api/site-theme/route.ts
// Which of the three saved homepage design directions (src/lib/theme.ts) is
// currently active. Stored as a single row in the existing `admin_settings`
// key/value table (key: 'theme:active') rather than a new table.

import { supabase } from 'lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_THEME, isThemeName } from 'src/lib/theme';

const SETTING_KEY = 'theme:active';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active theme:', error);
      return NextResponse.json({ theme: DEFAULT_THEME }, { status: 200 });
    }

    const theme = isThemeName(data?.value) ? data.value : DEFAULT_THEME;
    return NextResponse.json({ theme }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error fetching active theme:', error);
    return NextResponse.json({ theme: DEFAULT_THEME }, { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isThemeName(body.theme)) {
      return NextResponse.json({ error: 'Invalid theme name' }, { status: 400 });
    }

    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key: SETTING_KEY, value: body.theme, updated_at: new Date().toISOString() });

    if (error) {
      console.error('Error saving active theme:', error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ theme: body.theme }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error saving active theme:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
// AUDIT: new for v2 theme system.
