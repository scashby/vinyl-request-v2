// src/lib/utils/triggerNextRecognition.ts

export async function triggerNextRecognition(lastTrackDuration: number, lastLogId: number) {
  const delayMs = (lastTrackDuration / 2) * 1000;

  setTimeout(async () => {
    await fetch('/api/audio-recognition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy: 'auto-trigger', lastLogId })
    });
  }, delayMs);
}
