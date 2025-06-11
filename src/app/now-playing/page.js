// Now Playing page ("/now-playing")
// Public display of what's currently playing and up next, updates every 10s.

"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Page() {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [upNext, setUpNext] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .in('status', ['now_playing', 'up_next']);

      if (error) console.error(error);
      else {
        setNowPlaying(data.find(r => r.status === 'now_playing'));
        setUpNext(data.find(r => r.status === 'up_next'));
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center mt-12">
      <h1 className="text-4xl mb-6">🎶 Now Playing 🎶</h1>
      {nowPlaying ? (
        <div className="text-2xl font-bold mb-6">
          {nowPlaying.artist} — {nowPlaying.title} (Side {nowPlaying.side})
        </div>
      ) : (
        <p className="text-lg text-gray-500">Waiting for next track...</p>
      )}
      <h2 className="text-xl text-gray-700 mt-8">Up Next</h2>
      {upNext && (
        <p className="text-lg">{upNext.artist} — {upNext.title} (Side {upNext.side})</p>
      )}
    </div>
  );
}
