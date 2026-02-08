"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';

type BracketEntry = {
  id: number | null;
  artist: string | null;
  title: string | null;
  coverImage: string | null;
};

type BracketMatch = {
  id: string;
  round: number;
  order: number;
  red: BracketEntry;
  blue: BracketEntry;
  winner: 'red' | 'blue' | null;
};

type GameState = {
  activeMatchId?: string | null;
  matches?: BracketMatch[];
};

type GameSession = {
  id: number;
  game_type: string;
  game_state: GameState | null;
};

const getDisplayName = (entry: BracketEntry) => {
  if (!entry.title) return 'TBD';
  return `${entry.artist ?? 'Unknown'} — ${entry.title}`;
};

export default function ProjectorScreenPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState('');

  const activeMatch = useMemo(() => {
    const matches = session?.game_state?.matches ?? [];
    const activeId = session?.game_state?.activeMatchId;
    return matches.find((match) => match.id === activeId) ?? null;
  }, [session]);

  useEffect(() => {
    if (!sessionId || Number.isNaN(sessionId)) return;

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('game_sessions')
        .select('id, game_type, game_state')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else if (data) {
        setSession(data as GameSession);
      }
    };

    load();

    const channel = supabase
      .channel(`game-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.new) {
            setSession(payload.new as GameSession);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (!sessionId || Number.isNaN(sessionId)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Invalid session ID.
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-10 py-12">
      <div className="text-center mb-10">
        <p className="text-sm uppercase tracking-[0.4em] text-[#7bdcff]">
          Vinyl Games Live
        </p>
        <h1 className="text-4xl md:text-6xl font-black mt-4">
          Bracketology Showdown
        </h1>
      </div>

      {activeMatch ? (
        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          {(['red', 'blue'] as const).map((side) => {
            const entry = activeMatch[side];
            const isWinner = activeMatch.winner === side;
            return (
              <div
                key={`${activeMatch.id}-${side}`}
                className={`rounded-3xl border-4 p-8 transition duration-500 ${
                  isWinner ? 'border-green-400 bg-green-400/10' : 'border-white/20'
                }`}
              >
                <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {side === 'red' ? 'Red' : 'Blue'}
                </div>
                <div className="mt-5 flex items-center gap-6">
                  <div className="h-28 w-28 overflow-hidden rounded-2xl bg-white/10">
                    {entry.coverImage ? (
                      <Image
                        src={entry.coverImage}
                        alt={getDisplayName(entry)}
                        width={112}
                        height={112}
                        className="h-28 w-28 object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-28 w-28 bg-white/5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold">
                      {entry.title || 'TBD'}
                    </div>
                    <div className="text-white/60 text-lg">
                      {entry.artist || 'Awaiting selection'}
                    </div>
                  </div>
                </div>
                {isWinner && (
                  <div className="mt-6 text-green-300 text-lg font-semibold">
                    Winner!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-white/60 text-lg">
          Waiting for the next matchup...
        </div>
      )}
    </div>
  );
}
