// src/app/api/audio-recognition/manualOverride.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';

export async function POST(req: NextRequest) {
  const { logId, overrideTrack } = await req.json();

  const { error } = await supabase
    .from('audio_recognition_logs')
    .update({
      ...overrideTrack,
      service_used: 'manualOverride'
    })
    .eq('id', logId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'overridden' });
}
