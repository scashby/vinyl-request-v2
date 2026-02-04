import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';

const APPLE_MUSIC_TOKEN = process.env.APPLE_MUSIC_TOKEN;

const getHeaders = () => ({
  Authorization: `Bearer ${APPLE_MUSIC_TOKEN}`,
});

const extractLyrics = (payload: Record<string, unknown> | null): string | null => {
  if (!payload) return null;
  const data = (payload as { data?: Array<Record<string, unknown>> }).data ?? [];
  const first = data[0] ?? {};
  const attributes = (first.attributes ?? {}) as Record<string, unknown>;
  const lyrics = attributes.lyrics as string | undefined;
  if (lyrics) return lyrics;
  const text = attributes.text as string | undefined;
  return text ?? null;
};

export async function POST(req: Request) {
  if (!APPLE_MUSIC_TOKEN) {
    return NextResponse.json({ success: false, error: 'Apple Music token not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const storefront = (body?.storefront ?? 'us') as string;
  const songId = body?.songId as string | undefined;
  const recordingId = body?.recordingId as number | undefined;

  if (!songId) {
    return NextResponse.json({ success: false, error: 'songId required' }, { status: 400 });
  }

  const url = `https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}/lyrics`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ success: false, error: `Apple Music lyrics failed: ${res.status} ${text}` }, { status: 502 });
  }

  const json = (await res.json()) as Record<string, unknown>;
  const lyrics = extractLyrics(json);

  if (recordingId) {
    const supabase = supabaseServer(getAuthHeader(req));
    const { data: recording, error } = await supabase
      .from('recordings')
      .select('id, credits')
      .eq('id', recordingId)
      .single();

    if (error || !recording) {
      return NextResponse.json({ success: false, error: 'Recording not found' }, { status: 404 });
    }

    const credits = (recording.credits && typeof recording.credits === 'object' && !Array.isArray(recording.credits))
      ? (recording.credits as Record<string, unknown>)
      : {};

    const resolvedLyrics =
      typeof lyrics === 'string'
        ? lyrics
        : (typeof credits.lyrics === 'string' ? credits.lyrics : null);

    const updatedCredits = {
      ...credits,
      lyrics: resolvedLyrics,
      lyrics_source: 'apple_music',
      lyrics_last_synced_at: new Date().toISOString(),
      apple_music_song_id: songId,
    };

    const { error: updateError } = await supabase
      .from('recordings')
      .update({ credits: updatedCredits })
      .eq('id', recordingId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    storefront,
    songId,
    lyrics,
    raw: json,
  });
}
