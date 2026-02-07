"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from 'components/ui/Container';
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

export default function TriviaAdminPage() {
  const params = useParams();
  const sessionId = Number(params.sessionId);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const triviaState = session?.game_state?.trivia;
  const questions = triviaState?.questions ?? [];
  const currentIndex = triviaState?.currentIndex ?? 0;
  const reveal = triviaState?.reveal ?? false;

  const activeQuestion = useMemo(
    () => questions[currentIndex] ?? null,
    [questions, currentIndex]
  );

  const loadSession = async () => {
    if (!sessionId || Number.isNaN(sessionId)) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id, game_state')
      .eq('id', sessionId)
      .single();

    if (!fetchError && data) {
      setSession(data as GameSession);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const sendPatch = async (payload: unknown) => {
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/game-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update trivia.');
      }
      setSession(result.data as GameSession);
      setMessage('Trivia updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trivia.');
    }
  };

  const handleIndexChange = (index: number) => {
    sendPatch({ action: 'setTriviaIndex', index });
  };

  const toggleReveal = (nextReveal: boolean) => {
    sendPatch({ action: 'setTriviaReveal', reveal: nextReveal });
  };

  if (!sessionId || Number.isNaN(sessionId)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Invalid session ID.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Needle Drop Trivia
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            Trivia Control Center
          </h1>
          <p className="text-white/60 mt-2">
            Select the active question and reveal the answer on the projector screen.
          </p>

          {message && <p className="mt-4 text-sm text-green-400">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {loading ? (
            <div className="mt-10 text-white/60">Loading trivia...</div>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-lg font-semibold mb-4">Questions</h2>
                {questions.length === 0 && (
                  <p className="text-sm text-white/60">
                    Add trivia questions to game_state.trivia.questions for this session.
                  </p>
                )}
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <button
                      key={`${question.prompt ?? 'question'}-${index}`}
                      type="button"
                      onClick={() => handleIndexChange(index)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        index === currentIndex
                          ? 'border-[#7bdcff] bg-[#0f172a]'
                          : 'border-white/10 bg-black/40'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-widest text-white/60">
                        Question {index + 1}
                      </div>
                      <div className="mt-2 font-semibold">
                        {question.prompt || 'Untitled prompt'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-6">
                <h2 className="text-lg font-semibold mb-4">Live Preview</h2>
                {activeQuestion ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-white/60">
                        Prompt
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {activeQuestion.prompt || 'No prompt provided'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-white/60">
                        Answer
                      </div>
                      <div className="mt-2 text-lg">
                        {activeQuestion.answer ||
                          `${activeQuestion.artist ?? 'Unknown'} — ${
                            activeQuestion.title ?? 'Unknown'
                          }`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">
                    Select a question to preview.
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => toggleReveal(true)}
                    className="rounded-lg bg-[#7bdcff] px-4 py-2 font-semibold text-black"
                  >
                    Reveal Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleReveal(false)}
                    className="rounded-lg border border-white/20 px-4 py-2 font-semibold text-white"
                  >
                    Hide Answer
                  </button>
                  <div className="text-sm text-white/60 flex items-center">
                    Current: {reveal ? 'Revealed' : 'Hidden'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
