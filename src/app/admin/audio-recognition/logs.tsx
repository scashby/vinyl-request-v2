// src/app/admin/audio-recognition/logs.tsx
'use client';
import { useEffect, useState } from 'react';
import supabase from 'lib/supabaseClient';
import 'styles/internal.css';

export default function RecognitionLogsPage() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase.from('audio_recognition_logs').select('*').order('timestamp', { ascending: false });
      if (data) setLogs(data as Record<string, unknown>[]);
    };
    fetchLogs();
  }, [supabase]);

  return (
    <main className="p-4">
      <h1>Recognition Logs</h1>
      <ul>
        {logs.map((log, i) => (
          <li key={i}><pre>{JSON.stringify(log, null, 2)}</pre></li>
        ))}
      </ul>
    </main>
  );
}
