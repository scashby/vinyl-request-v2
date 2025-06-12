// Admin Set Now Playing page ("/admin/set-now-playing")
// Lets admins update the status (Now Playing / Up Next) for each request in the Supabase `requests` table.

"use client";

import { useEffect, useState } from 'react';
import { supabase } from 'lib/supabaseClient'

export default function Page() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    async function fetchRequests() {
      const { data } = await supabase
        .from('requests')
        .select('*')
        .order('votes', { ascending: false })
        .order('timestamp', { ascending: true });
      setRequests(data || []);
    }
    fetchRequests();
  }, []);

  const updateStatus = async (id, status) => {
    await supabase.from('requests').update({ status }).eq('id', id);
    const { data } = await supabase
      .from('requests')
      .select('*')
      .order('votes', { ascending: false })
      .order('timestamp', { ascending: true });
    setRequests(data || []);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Now Playing / Up Next</h1>
      {requests.map(req => (
        <div key={req.id} className="bg-gray-800 p-4 rounded mb-2 flex justify-between items-center">
          <div>
            <p className="text-lg">{req.artist} – {req.title} (Side {req.side})</p>
            <p className="text-sm italic text-zinc-400">Status: {req.status || 'queued'}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="bg-green-600 px-3 py-1 rounded text-sm"
              onClick={() => updateStatus(req.id, 'now-playing')}
            >
              Now Playing
            </button>
            <button
              className="bg-yellow-500 px-3 py-1 rounded text-sm"
              onClick={() => updateStatus(req.id, 'up-next')}
            >
              Up Next
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
