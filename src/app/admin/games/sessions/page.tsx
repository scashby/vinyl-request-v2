"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

const LOCAL_TEMPLATES_KEY = 'vinylGamesTemplates';

const readLocalTemplates = (): TemplateRow[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(LOCAL_TEMPLATES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TemplateRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get('eventId');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [eventId, setEventId] = useState('');
  const [gameType, setGameType] = useState('bracketology');
  const [templateId, setTemplateId] = useState('');
  const [triviaJson, setTriviaJson] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [usingLocalTemplates, setUsingLocalTemplates] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(!eventIdParam);

  const activeEvent = useMemo(
    () => events.find((event) => event.id === Number(eventId)) ?? null,
    [events, eventId]
  );

  const templatesForGameType = useMemo(
    () => templates.filter((template) => template.game_type === gameType),
    [templates, gameType]
  );

  const loadEvents = async () => {
    setEventsError('');
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, has_games, game_modes')
      .order('date', { ascending: true });

    if (error) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('events')
        .select('id, title, date')
        .order('date', { ascending: true });

      if (fallbackError) {
        setEvents([]);
        setEventsError('Unable to load events.');
        return;
      }

      setEventsError('Games fields missing on events. Run sql/add-events-games.sql to add them.');
      setEvents(
        ((fallback ?? []) as Array<{ id: number; title: string; date: string }>).map((row) => ({
          ...row,
          has_games: null,
          game_modes: null,
        }))
      );
      return;
    }

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
    try {
      const response = await fetch('/api/game-templates');
      if (!response.ok) {
        throw new Error('Failed to load templates.');
      }
      const result = await response.json();
      setTemplates(result.data as TemplateRow[]);
      setUsingLocalTemplates(false);
    } catch {
      setTemplates(readLocalTemplates());
      setUsingLocalTemplates(true);
    }
  };

  useEffect(() => {
    loadEvents();
    loadSessions();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (eventIdParam) {
      setEventId(eventIdParam);
      setShowAllSessions(false);
    }
  }, [eventIdParam]);

  useEffect(() => {
    if (!templateId) return;
    const selected = templates.find((template) => template.id === Number(templateId));
    if (selected && selected.game_type !== gameType) {
      setTemplateId('');
    }
  }, [gameType, templateId, templates]);

  const handleCreateSession = async () => {
    setStatus('');
    setError('');

    if (!eventId) {
      setError('Select an event.');
      return;
    }

    let triviaQuestions = undefined;
    if (gameType === 'trivia' && triviaJson.trim()) {
      try {
        triviaQuestions = JSON.parse(triviaJson.trim());
      } catch {
        setError('Trivia JSON is invalid.');
        return;
      }
    }

    const selectedTemplate = templateId
      ? templates.find((item) => item.id === Number(templateId))
      : undefined;
    if (selectedTemplate && selectedTemplate.game_type !== gameType) {
      setError('Template does not match the selected game type.');
      return;
    }
    const localTemplateState =
      usingLocalTemplates && selectedTemplate ? selectedTemplate.template_state : undefined;

    const response = await fetch('/api/game-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: eventId ? Number(eventId) : undefined,
        gameType,
        templateId: !usingLocalTemplates && templateId ? Number(templateId) : undefined,
        templateState: usingLocalTemplates ? localTemplateState : undefined,
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
      return `/admin/games/bingo?sessionId=${session.id}`;
    }
    return `/admin/games/${session.id}`;
  };

  const filteredSessions = useMemo(() => {
    if (!eventIdParam || showAllSessions) return sessions;
    return sessions.filter((session) => session.event_id === Number(eventIdParam));
  }, [eventIdParam, showAllSessions, sessions]);

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <Container size="lg">
        <div className="py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Admin · Vinyl Games
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">
            Game Sessions
          </h1>
          <p className="text-slate-600 mt-2">
            Step 1: Pick an event. Step 2: Choose the game type. Step 3: (Optional) attach a template. Step 4: Create session.
          </p>
          {eventIdParam && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Managing sessions for event ID <span className="text-slate-900">{eventIdParam}</span>.
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
              <h2 className="text-lg font-semibold">Create a session</h2>
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Event
                </label>
                <select
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                >
                  <option value="">Select an event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} · {event.date}
                    </option>
                  ))}
                </select>
                {eventsError && (
                  <p className="text-xs text-amber-600 mt-2">{eventsError}</p>
                )}
                {activeEvent?.has_games === false && (
                  <p className="text-xs text-amber-600 mt-2">
                    This event is not marked as having Vinyl Games yet.
                  </p>
                )}
                {gameType === 'bracketology' && !eventId && (
                  <p className="text-xs text-amber-600 mt-2">
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                >
                  <option value="">Select a template</option>
                  {templatesForGameType.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.game_type}
                    </option>
                  ))}
                </select>
                {templatesForGameType.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">No templates saved for this game type yet.</p>
                )}
                {usingLocalTemplates && (
                  <p className="mt-2 text-xs text-amber-600">
                    Using locally stored templates (API unavailable).
                  </p>
                )}
                {templateId && gameType === 'trivia' && !triviaJson.trim() && (
                  <p className="mt-2 text-xs text-slate-500">
                    Trivia questions will load from the selected template.
                  </p>
                )}
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-mono shadow-sm"
                    placeholder='[{"prompt":"Name the sample","artist":"Artist","title":"Track","coverImage":""}]'
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateSession}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Create Session
              </button>

              {status && <p className="text-sm text-emerald-600">{status}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Active sessions</h2>
                {eventIdParam && (
                  <button
                    type="button"
                    onClick={() => setShowAllSessions((prev) => !prev)}
                    className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                  >
                    {showAllSessions ? 'Filter to event' : 'Show all'}
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {filteredSessions.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No sessions yet. Create one to get started.
                  </p>
                )}
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-xs uppercase tracking-widest text-slate-500">
                      {gameTypeLabels[session.game_type] || session.game_type}
                    </div>
                    <div className="mt-2 font-semibold">
                      {session.events?.title ?? 'Untitled event'}
                    </div>
                    <div className="text-sm text-slate-500">
                      {session.events?.date ?? 'TBA'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={getSessionLink(session)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Open Controls
                      </Link>
                      {session.game_type === 'bracketology' && (
                        <Link
                          href={`/play/${session.id}/screen`}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
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
