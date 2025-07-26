/ src/app/api/audio-recognition/logs/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data, error } = await supabase
      .from('audio_recognition_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      logs: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch logs' 
    }, { status: 500 });
  }
}