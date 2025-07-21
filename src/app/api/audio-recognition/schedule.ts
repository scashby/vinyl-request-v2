// src/app/api/audio-recognition/schedule.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { lastTrackDuration, lastLogId } = await req.json();

  // Schedule next recognition in duration / 2
  const delayMs = (lastTrackDuration / 2) * 1000;

  setTimeout(async () => {
    await fetch('http://localhost:3000/api/audio-recognition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy: 'auto-scheduler', lastLogId })
    });
  }, delayMs);

  return NextResponse.json({ status: 'scheduled', nextIn: delayMs });
}
