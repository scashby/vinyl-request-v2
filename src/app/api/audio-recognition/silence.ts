// src/app/api/audio-recognition/silence.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';

export async function POST(req: NextRequest) {
  const { reason, triggeredBy, context } = await req.json();

  const { error } = await supabase.from('audio_recognition_logs').insert([
    {
      service_used: 'silence',
      confidence: 0.0,
      title: null,
      artist: null,
      album: null,
      raw_response: { reason, triggeredBy, context }
    }
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'logged' });
}
