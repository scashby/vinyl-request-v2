'use client';
import { useEffect, useState } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const supabase = createPagesBrowserClient<Database>();

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('audio_recognition_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error) setLogs(data || []);
    };
    fetchLogs();
  }, []);

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Recognition Logs</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Source</th>
            <th>Match</th>
            <th>Collection ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.id}</td>
              <td>{log.source}</td>
              <td>{log.title} - {log.artist}</td>
              <td>{log.collection_id ?? '—'}</td>
              <td>{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
