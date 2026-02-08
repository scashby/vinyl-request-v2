"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Container } from 'components/ui/Container';
import { supabase } from 'src/lib/supabaseClient';

type EventRow = {
  id: number;
  title: string;
  date: string;
  has_games: boolean | null;
  game_modes: string[] | string | null;
};

type TemplateRow = {
  id: number;
  name: string;
  game_type: string;
  template_state: unknown;
};

type SessionRow = {
  id: number;
  event_id: number | null;
  crate_id: number | null;
  game_type: string;
  created_at: string;
  events?: {
    id: number;
    title: string;
    date: string;
  } | null;
};

const gameTypeLabels: Record<string, string> = {
  bracketology: 'Bracketology',
  trivia: 'Needle Drop Trivia',
  bingo: 'Vinyl Bingo',
};

export default function AdminGamesPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [gameType, setGameType] = useState('bracketology');
  const [templateId, setTemplateId] = useState('');
  const [triviaJson, setTriviaJson] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const activeEvent = useMemo(
    () => events.find((event) => event.id === Number(eventId)) ?? null,
    [events, eventId]
  );

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, title, date, has_games, game_modes')
      .order('date', { ascending: true });
    setEvents((data as EventRow[]) ?? []);
  };

  const loadSessions = async () => {
    const response = await fetch('/api/game-sessions');
    const result = await response.json();
    if (response.ok) {
      setSessions(result.data as SessionRow[]);
    }
  };

  const loadTemplates = async () => {
    const response = await fetch('/api/game-templates');
    const result = await response.json();
    if (response.ok) {
      setTemplates(result.data as TemplateRow[]);
    }
  };

  useEffect(() => {
    loadEvents();
    loadSessions();
    loadTemplates();
  }, []);

  const handleCreateSession = async () => {
    setStatus('');
    setError('');

    let triviaQuestions = undefined;
    if (gameType === 'trivia' && triviaJson.trim()) {
      try {
        triviaQuestions = JSON.parse(triviaJson.trim());
      } catch (parseError) {
        setError('Trivia JSON is invalid.');
        return;
      }
    }

    const response = await fetch('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: eventId ? Number(eventId) : undefined,
        gameType,
        templateId: templateId ? Number(templateId) : undefined,
        triviaQuestions,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to create session.');
      return;
    }

    setStatus('Session created.');
    setEventId('');
    setTemplateId('');
    setTriviaJson('');
    await loadSessions();
  };

  const getSessionLink = (session: SessionRow) => {
    if (session.game_type === 'trivia') {
      return `/admin/games/${session.id}/trivia`;
    }
    if (session.game_type === 'bingo') {
      return '/admin/games/bingo';
    }
    return `/admin/games/${session.id}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Vinyl Games
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            Game Session Manager
          </h1>
          <p className="text-white/60 mt-2">
            Create game sessions tied to events and jump into live controls.
          </p>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <h2 className="text-lg font-semibold">Create a session</h2>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Event
                </label>
                <select
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} · {event.date}
                    </option>
                  ))}
                </select>
                {activeEvent?.has_games === false && (
                  <p className="text-xs text-yellow-300 mt-2">
                    This event is not marked as having Vinyl Games yet.
                  </p>
                )}
                {gameType === 'bracketology' && !eventId && (
                  <p className="text-xs text-yellow-300 mt-2">
                    Bracketology sessions require an event.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Game type
                </label>
                <select
                  value={gameType}
                  onChange={(event) => setGameType(event.target.value)}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                >
                  <option value="bracketology">Bracketology</option>
                  <option value="bingo">Vinyl Bingo</option>
                  <option value="trivia">Needle Drop Trivia</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Template (optional)
                </label>
                <select
                  value={templateId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setTemplateId(nextId);
                    const template = templates.find((item) => item.id === Number(nextId));
                    if (template) {
                      setGameType(template.game_type);
                    }
                  }}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.game_type}
                    </option>
                  ))}
                </select>
              </div>

              {gameType === 'trivia' && (
                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    Trivia questions (JSON array)
                  </label>
                  <textarea
                    value={triviaJson}
                    onChange={(event) => setTriviaJson(event.target.value)}
                    rows={6}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white font-mono text-xs"
                    placeholder='[{"prompt":"Name the sample","artist":"Artist","title":"Track","coverImage":""}]'
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateSession}
                className="rounded-lg bg-[#7bdcff] px-4 py-2 font-semibold text-black"
              >
                Create Session
              </button>

              {status && <p className="text-sm text-green-400">{status}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-6">
              <h2 className="text-lg font-semibold mb-4">Active sessions</h2>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {sessions.length === 0 && (
                  <p className="text-sm text-white/60">
                    No sessions yet. Create one to get started.
                  </p>
                )}
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="text-xs uppercase tracking-widest text-white/60">
                      {gameTypeLabels[session.game_type] || session.game_type}
                    </div>
                    <div className="mt-2 font-semibold">
                      {session.events?.title ?? 'Untitled event'}
                    </div>
                    <div className="text-sm text-white/60">
                      {session.events?.date ?? 'TBA'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={getSessionLink(session)}
                        className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
                      >
                        Open Controls
                      </Link>
                      {session.game_type === 'bracketology' && (
                        <Link
                          href={`/play/${session.id}/screen`}
                          className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold hover:border-white/40"
                        >
                          Projector Screen
                        </Link>
                      )}
                      {session.game_type === 'trivia' && (
                        <Link
                          href={`/play/${session.id}/trivia`}
                          className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold hover:border-white/40"
                        >
                          Trivia Screen
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
