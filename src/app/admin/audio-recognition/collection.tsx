// src/app/admin/audio-recognition/collection.tsx

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from 'types/supabase';

interface Match {
  id: number;
  artist: string;
  title: string;
  album: string;
}

export default function CollectionMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient<Database>();

  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      const artist = searchParams.get('artist') || '';
      const title = searchParams.get('title') || '';

      const { data, error } = await supabase
        .from('album_context')
        .select('id, artist, title, album')
        .ilike('artist', `%${artist}%`)
        .ilike('title', `%${title}%`);

      if (error) {
        console.error('Error fetching collection matches:', error);
        return;
      }

      setMatches(data || []);
    };

    fetchMatches();
  }, [searchParams, supabase]);

  const handleConfirm = () => {
    if (selected !== null) {
      router.push(`/admin/audio-recognition/override?id=${selected}`);
    }
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Collection Match</h1>
      <p className="text-sm text-gray-600">Select the best match from your collection.</p>
      <ul className="space-y-2">
        {matches.map((match) => (
          <li
            key={match.id}
            className={`border p-4 rounded cursor-pointer ${selected === match.id ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
            onClick={() => setSelected(match.id)}
          >
            <strong>{match.artist}</strong> — {match.title} <em>({match.album})</em>
          </li>
        ))}
      </ul>
      <button
        disabled={selected === null}
        onClick={handleConfirm}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        Confirm Selection
      </button>
      <div className="pt-4">
        <Link href="/admin/audio-recognition/page">
          ← Back to Recognition
        </Link>
      </div>
    </main>
  );
}
