'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';

export default function OverridePage() {
  const supabase = createPagesBrowserClient<Database>();
  const searchParams = useSearchParams();
  const logId = searchParams.get('id');
  const [log, setLog] = useState<any>(null);

  useEffect(() => {
    if (!logId) return;
    supabase.from('audio_recognition_logs').select('*').eq('id', logId).single()
      .then(({ data }) => setLog(data));
  }, [logId]);

  const updateMatch = async (collectionId: string) => {
    await supabase.from('audio_recognition_logs')
      .update({ collection_id: collectionId, manual_override: true })
      .eq('id', logId);
    alert('Override saved.');
  };

  return (
    <main style={{ padding: '1rem' }}>
      <h1>Override Recognition</h1>
      {log ? (
        <>
          <p><strong>Match:</strong> {log.title} - {log.artist}</p>
          <input placeholder="Collection ID" onBlur={(e) => updateMatch(e.target.value)} />
        </>
      ) : <p>Loading…</p>}
    </main>
  );
}
