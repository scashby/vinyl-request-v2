// src/app/admin/audio-recognition/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient';

interface RecognitionLog {
  id: number;
  artist: string | null;
  title: string | null;
  album: string | null;
  source: string | null;
  confidence: number | null;
  created_at: string;
}

export default function AudioRecognitionPage() {
  const [logs, setLogs] = useState<RecognitionLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const confirmTrack = async (logId: number, artist: string, title: string, album: string) => {
    await supabase.from('now_playing').delete().neq('id', 0);
    await supabase.from('now_playing').insert({ artist, title, album });
    await supabase.from('audio_recognition_logs').update({ confirmed: true }).eq('id', logId);
  };

  const skipTrack = async (logId: number) => {
    await supabase.from('audio_recognition_logs').update({ confidence: 0 }).eq('id', logId);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Audio Recognition Logs</h1>
      {loading && <p>Loading...</p>}
      {!loading && logs.length === 0 && <p>No logs found.</p>}
      <ul>
        {logs.map((log) => (
          <li key={log.id} style={{ marginBottom: '1rem' }}>
            <strong>{log.artist} – {log.title}</strong> ({log.album}) from {log.source}<br />
            Confidence: {log.confidence}<br />
            <button onClick={() => confirmTrack(log.id, log.artist || '', log.title || '', log.album || '')}>✅ Confirm</button>
            <button onClick={() => skipTrack(log.id)}>🗑 Skip</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
