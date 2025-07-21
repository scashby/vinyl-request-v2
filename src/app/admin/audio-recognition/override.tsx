// src/app/admin/audio-recognition/override.tsx
'use client';
import { useEffect, useState } from 'react';
import supabase from 'lib/supabaseClient';
import 'styles/internal.css';

export default function ManualOverridePage() {
  const [tracks, setTracks] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const fetchTracks = async () => {
      const { data } = await supabase.from('audio_recognition_logs').select('*').limit(25).order('timestamp', { ascending: false });
      if (data) setTracks(data as Record<string, unknown>[]);
    };
    fetchTracks();
  }, [supabase]);

  return (
    <main className="p-4">
      <h1>Manual Recognition Override</h1>
      <ul>
        {tracks.map((track, i) => (
          <li key={i}><pre>{JSON.stringify(track, null, 2)}</pre></li>
        ))}
      </ul>
    </main>
  );
}
