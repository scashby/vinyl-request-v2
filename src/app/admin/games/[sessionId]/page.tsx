"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Container } from 'components/ui/Container';
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
  event_id: number | null;
  game_type: string;
  game_state: GameState | null;
};

const rounds = [
  { id: 1, label: 'Round of 16' },
  { id: 2, label: 'Quarterfinals' },
  { id: 3, label: 'Semifinals' },
  { id: 4, label: 'Finals' },
];

const getMatchTitle = (entry: BracketEntry) =>
  entry.title ? `${entry.artist ?? 'Unknown'} — ${entry.title}` : 'TBD';

export default function GameSessionAdminPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const matchesByRound = useMemo(() => {
    const matches = session?.game_state?.matches ?? [];
    return rounds.map((round) => ({
      ...round,
      matches: matches.filter((match) => match.round === round.id),
    }));
  }, [session]);

  const activeMatchId = session?.game_state?.activeMatchId ?? null;

  const loadSession = async () => {
    if (!sessionId || Number.isNaN(sessionId)) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, event_id, game_type, game_state')
      .eq('id', sessionId)
      .single();

    if (!error && data) {
      setSession(data as GameSession);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const sendPatch = async (payload: unknown) => {
    setActionMessage('');
    setActionError('');
    try {
      const response = await fetch(`/api/game-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update session.');
      }
      setSession(result.data as GameSession);
      setActionMessage('Game state updated.');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Failed to update session.'
      );
    }
  };

  const handleInitialize = () =>
    sendPatch({ action: 'initializeBracket' });

  const handleSetActive = (matchId: string) =>
    sendPatch({ action: 'setActiveMatch', matchId });

  const handleWinner = (matchId: string, winner: 'red' | 'blue') =>
    sendPatch({ action: 'recordWinner', matchId, winner });

  if (!sessionId || Number.isNaN(sessionId)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Invalid session ID.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070f] text-white">
      <Container size="xl">
        <div className="py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[#7bdcff]">
                Admin · Vinyl Games
              </p>
              <h1 className="text-3xl md:text-4xl font-black mt-2">
                Session {sessionId}
              </h1>
              <p className="text-white/60 mt-2">
                Manage the live bracket and drive the projector screen.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInitialize}
              className="rounded-lg bg-[#7bdcff] px-5 py-3 font-bold text-black hover:bg-white"
            >
              Initialize Bracket from Votes
            </button>
          </div>

          {actionMessage && (
            <p className="mt-4 text-sm text-green-400">{actionMessage}</p>
          )}
          {actionError && (
            <p className="mt-4 text-sm text-red-400">{actionError}</p>
          )}

          {loading && (
            <div className="mt-10 text-white/60">Loading session...</div>
          )}

          {!loading && (
            <div className="mt-10 grid gap-6 lg:grid-cols-4">
              {matchesByRound.map((round) => (
                <div key={round.id} className="space-y-4">
                  <h2 className="text-lg font-semibold text-white/80">
                    {round.label}
                  </h2>
                  {round.matches.length === 0 && (
                    <div className="text-sm text-white/40">
                      No matches yet.
                    </div>
                  )}
                  {round.matches.map((match) => {
                    const isActive = match.id === activeMatchId;
                    return (
                      <div
                        key={match.id}
                        className={`rounded-xl border p-4 transition ${
                          isActive
                            ? 'border-[#7bdcff] bg-[#0f172a]'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSetActive(match.id)}
                          className="text-xs uppercase tracking-widest text-[#7bdcff]"
                        >
                          {isActive ? 'Active Match' : 'Set Active'}
                        </button>

                        <div className="mt-3 space-y-3">
                          {(['red', 'blue'] as const).map((side) => {
                            const entry = match[side];
                            const isWinner = match.winner === side;
                            return (
                              <div
                                key={`${match.id}-${side}`}
                                className={`flex items-center gap-3 rounded-lg border p-2 ${
                                  isWinner
                                    ? 'border-green-400 bg-green-400/10'
                                    : 'border-white/10'
                                }`}
                              >
                                <div className="h-10 w-10 overflow-hidden rounded bg-white/10">
                                  {entry.coverImage ? (
                                    <Image
                                      src={entry.coverImage}
                                      alt={getMatchTitle(entry)}
                                      width={40}
                                      height={40}
                                      className="h-10 w-10 object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="h-10 w-10 bg-white/5" />
                                  )}
                                </div>
                                <div className="flex-1 text-sm">
                                  <div className="font-semibold">
                                    {entry.title || 'TBD'}
                                  </div>
                                  <div className="text-white/60">
                                    {entry.artist || 'Awaiting'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleWinner(match.id, side)}
                                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold hover:border-[#7bdcff]"
                                >
                                  {side === 'red' ? 'Red Wins' : 'Blue Wins'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
