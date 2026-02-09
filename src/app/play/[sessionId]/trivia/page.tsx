"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { supabase } from 'src/lib/supabaseClient';

type TriviaQuestion = {
  prompt?: string;
  answer?: string;
  artist?: string;
  title?: string;
  coverImage?: string;
};

type TriviaState = {
  currentIndex?: number;
  reveal?: boolean;
  questions?: TriviaQuestion[];
};

type GameSession = {
  id: number;
  game_state: {
    trivia?: TriviaState;
  } | null;
};

export default function TriviaScreenPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState('');

  const triviaState = session?.game_state?.trivia;
  const questions = triviaState?.questions ?? [];
  const currentIndex = triviaState?.currentIndex ?? 0;
  const reveal = triviaState?.reveal ?? false;

  const activeQuestion = useMemo(
    () => questions[currentIndex] ?? null,
    [questions, currentIndex]
  );

  useEffect(() => {
    if (!sessionId || Number.isNaN(sessionId)) return;

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('game_sessions')
        .select('id, game_state')
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
      .channel(`game-session-trivia-${sessionId}`)
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
    <div className="min-h-screen bg-[#05070f] text-white flex flex-col items-center justify-center px-10 py-12">
      <div className="text-center mb-12 max-w-3xl">
        <p className="text-sm uppercase tracking-[0.4em] text-[#7bdcff]">
          Needle Drop Trivia
        </p>
        <h1 className="text-4xl md:text-6xl font-black mt-4">
          Can you name the track?
        </h1>
        <p className="text-white/60 mt-4 text-lg">
          Listen carefully to the needle drop, then shout out your guess.
        </p>
      </div>

      {activeQuestion ? (
        <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-sm uppercase tracking-widest text-white/50">
            Current Prompt
          </div>
          <div className="mt-4 text-2xl md:text-3xl font-semibold">
            {activeQuestion.prompt || 'Identify the song or sample.'}
          </div>

          {reveal ? (
            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="h-40 w-40 overflow-hidden rounded-2xl bg-white/10">
                {activeQuestion.coverImage ? (
                  <Image
                    src={activeQuestion.coverImage}
                    alt={activeQuestion.title ?? 'Answer'}
                    width={160}
                    height={160}
                    className="h-40 w-40 object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="h-40 w-40 bg-white/5" />
                )}
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {activeQuestion.answer ||
                    `${activeQuestion.artist ?? 'Unknown'} — ${
                      activeQuestion.title ?? 'Unknown'
                    }`}
                </div>
                <div className="text-white/60 text-lg mt-2">
                  {activeQuestion.artist && activeQuestion.title
                    ? `${activeQuestion.artist} · ${activeQuestion.title}`
                    : 'Answer revealed!'}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-white/50 text-lg">
              Answer hidden. Wait for the host to reveal.
            </div>
          )}
        </div>
      ) : (
        <div className="text-white/60 text-lg">Waiting for the first question...</div>
      )}
    </div>
  );
}
