import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const releaseIdRaw = searchParams.get('releaseId');
  const releaseId = releaseIdRaw ? Number(releaseIdRaw) : NaN;

  if (!releaseId || Number.isNaN(releaseId)) {
    return NextResponse.json({ error: 'releaseId is required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('release_tracks')
    .select('id, position, side, title_override, recording_id, recordings ( title, track_artist )')
    .eq('release_id', releaseId)
    .order('position', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? []).map((row) => {
    const recording = Array.isArray(row.recordings)
      ? row.recordings[0]
      : row.recordings;
    return {
      id: row.id,
      recordingId: row.recording_id,
      position: row.position,
      side: row.side,
      title: row.title_override || recording?.title || 'Unknown title',
      trackArtist: recording?.track_artist || null,
    };
  });

  return NextResponse.json({ data: results });
}
