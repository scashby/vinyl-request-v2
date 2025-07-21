// src/app/api/audio-recognition/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { recognizeWithACRCloud } from 'lib/recognizers/acr';
import { recognizeWithAudD } from 'lib/recognizers/audd';

export async function POST(req: NextRequest) {
  try {
    const { audioBuffer } = await req.json();
    if (!audioBuffer) return NextResponse.json({ error: 'Missing audio buffer' }, { status: 400 });

    // Recognize via ACRCloud
    const acrResult = await recognizeWithACRCloud();

    // If low confidence or no result, fallback to AudD
    const primaryResult = acrResult?.confidence > 0.85 ? acrResult : await recognizeWithAudD();
    if (!primaryResult) {
      await supabase.from('audio_recognition_logs').insert({
        service_used: acrResult ? 'AudD' : 'ACRCloud',
        confidence: 0,
        raw_response: null,
        artist: null,
        title: null,
        album: null,
        audio_duration: 10,
      });
      return NextResponse.json({ match: null });
    }

    // Match against album_context
    const { data: collectionMatches } = await supabase.from('album_context').select('*')
      .ilike('artist', `%${primaryResult.artist}%`)
      .ilike('title', `%${primaryResult.title}%`);

    const matched = collectionMatches?.[0] || null;

    // Log result
    await supabase.from('audio_recognition_logs').insert({
      service_used: primaryResult.source,
      confidence: primaryResult.confidence,
      artist: primaryResult.artist,
      title: primaryResult.title,
      album: primaryResult.album,
      raw_response: primaryResult.raw_response,
      audio_duration: 10,
    });

    return NextResponse.json({ match: primaryResult, collection_match: matched });
  } catch (err) {
    console.error('[Recognition Error]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
