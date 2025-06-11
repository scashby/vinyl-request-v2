// Admin Edit Queue page ("/admin/edit-queue")
// Allows admins to view and remove requests from the queue (Supabase `requests` table).

"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';

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

  const removeRequest = async (id) => {
    await supabase.from('requests').delete().eq('id', id);
    setRequests(requests.filter(r => r.id !== id));
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Edit Queue</h1>
      {requests.map((req) => (
        <div key={req.id} className="bg-gray-800 p-4 rounded mb-2 flex justify-between items-center">
          <div>
            <p className="text-lg">{req.artist} – {req.title} (Side {req.side})</p>
            <p className="text-sm italic text-zinc-400">Votes: {req.votes}</p>
          </div>
          <button
            className="text-sm bg-red-600 px-3 py-1 rounded hover:bg-red-700"
            onClick={() => removeRequest(req.id)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
