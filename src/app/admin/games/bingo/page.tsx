"use client";

import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from 'src/lib/supabaseClient';
import { Container } from 'components/ui/Container';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Crate = {
  id: number;
  name: string;
};

type BingoItem = {
  id: number;
  title: string;
  artist: string;
};

type TemplateRow = {
  id: number;
  name: string;
  game_type: string;
};

type SessionRow = {
  id: number;
  event_id: number | null;
  game_type: string;
  created_at: string;
  events?: {
    id: number;
    title: string;
    date: string;
  } | null;
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildCard = (items: BingoItem[]) => {
  const selections = shuffle(items).slice(0, 24);
  const grid: (BingoItem | null)[] = [];
  let index = 0;
  for (let i = 0; i < 25; i += 1) {
    if (i === 12) {
      grid.push(null);
    } else {
      grid.push(selections[index]);
      index += 1;
    }
  }
  return grid;
};

const addCardToPdf = (doc: jsPDF, grid: (BingoItem | null)[], title: string) => {
  const pageWidth = 210;
  const margin = 15;
  const cellSize = (pageWidth - margin * 2) / 5;
  const startX = margin;
  const startY = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, pageWidth / 2, 25, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const index = row * 5 + col;
      const x = startX + col * cellSize;
      const y = startY + row * cellSize;
      doc.rect(x, y, cellSize, cellSize);

      if (index === 12) {
        doc.setFont('helvetica', 'bold');
        doc.text('FREE', x + cellSize / 2, y + cellSize / 2, {
          align: 'center',
          baseline: 'middle',
        });
        doc.setFont('helvetica', 'normal');
      } else {
        const item = grid[index];
        if (item) {
          const text = `${item.artist} — ${item.title}`;
          const lines = doc.splitTextToSize(text, cellSize - 6);
          doc.text(lines, x + 3, y + 6);
        }
      }
    }
  }
};

export default function BingoCardPage() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  const [crates, setCrates] = useState<Crate[]>([]);
  const [crateId, setCrateId] = useState('');
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [useSession, setUseSession] = useState(false);
  const [cardCount, setCardCount] = useState(10);
  const [items, setItems] = useState<BingoItem[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canGenerate = useMemo(
    () => items.length >= 24 && cardCount > 0,
    [items.length, cardCount]
  );

  useEffect(() => {
    const loadCrates = async () => {
      const { data } = await supabase.from('crates').select('id, name').order('name');
      setCrates((data as Crate[]) ?? []);
    };
    const loadTemplates = async () => {
      const response = await fetch('/api/game-templates');
      const result = await response.json();
      if (response.ok) {
        const all = (result.data as TemplateRow[]) ?? [];
        setTemplates(all.filter((template) => template.game_type === 'bingo'));
      }
    };
    const loadSessions = async () => {
      const response = await fetch('/api/game-sessions');
      const result = await response.json();
      if (response.ok) {
        const all = (result.data as SessionRow[]) ?? [];
        setSessions(all.filter((session) => session.game_type === 'bingo'));
      }
    };
    loadCrates();
    loadTemplates();
    loadSessions();
  }, []);

  useEffect(() => {
    if (sessionIdParam) {
      setUseSession(true);
      setSessionId(sessionIdParam);
    }
  }, [sessionIdParam]);

  const handleLoadItems = async () => {
    setStatus('');
    setError('');
    setItems([]);

    if (useSession && !sessionId) {
      setError('Select a bingo session.');
      return;
    }
    if (useTemplate && !templateId) {
      setError('Select a bingo template.');
      return;
    }
    if (!useTemplate && !crateId) {
      setError('Select a crate.');
      return;
    }

    const response = await fetch('/api/bingo/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        useSession
          ? { sessionId: Number(sessionId) }
          : useTemplate
          ? { templateId: Number(templateId) }
          : { crateId: Number(crateId) }
      ),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to load crate items.');
      return;
    }

    setItems(result.items || []);
    setStatus(`${result.items?.length ?? 0} records loaded.`);
  };

  const handleGenerate = () => {
    setStatus('');
    setError('');

    if (!canGenerate) {
      setError('You need at least 24 items to build bingo cards.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < cardCount; i += 1) {
      if (i > 0) {
        doc.addPage();
      }
      const grid = buildCard(items);
      addCardToPdf(doc, grid, 'Vinyl Bingo');
      doc.text(`Card ${i + 1}`, 190, 290, { align: 'right' });
    }

    doc.save(`vinyl-bingo-${new Date().toISOString().split('T')[0]}.pdf`);
    setStatus('PDF generated.');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Vinyl Bingo
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            Bingo Card Generator
          </h1>
          <p className="text-white/60 mt-2">
            Pick a crate, template, or session and generate randomized PDF bingo cards.
          </p>
          <div className="mt-3">
            <Link
              href="/admin/games/templates"
              className="text-xs font-semibold text-[#7bdcff] hover:underline"
            >
              Manage Bingo Templates
            </Link>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Source
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUseTemplate(false);
                      setUseSession(false);
                    }}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      !useTemplate && !useSession
                        ? 'bg-[#7bdcff] text-black'
                        : 'border border-white/20 text-white'
                    }`}
                  >
                    Crate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseTemplate(true);
                      setUseSession(false);
                    }}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      useTemplate
                        ? 'bg-[#7bdcff] text-black'
                        : 'border border-white/20 text-white'
                    }`}
                  >
                    Template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSession(true);
                      setUseTemplate(false);
                    }}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      useSession
                        ? 'bg-[#7bdcff] text-black'
                        : 'border border-white/20 text-white'
                    }`}
                  >
                    Session
                  </button>
                </div>

                {!useTemplate && !useSession && (
                  <select
                    value={crateId}
                    onChange={(event) => setCrateId(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  >
                    <option value="">Select a crate</option>
                    {crates.map((crate) => (
                      <option key={crate.id} value={crate.id}>
                        {crate.name}
                      </option>
                    ))}
                  </select>
                )}

                {useTemplate && (
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  >
                    <option value="">Select a bingo template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                )}

                {useSession && (
                  <select
                    value={sessionId}
                    onChange={(event) => setSessionId(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  >
                    <option value="">Select a bingo session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.events?.title ?? `Session ${session.id}`} · {session.events?.date ?? 'TBA'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">
                  Number of cards
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={cardCount}
                  onChange={(event) => setCardCount(Number(event.target.value))}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleLoadItems}
                  disabled={useSession ? !sessionId : useTemplate ? !templateId : !crateId}
                  className="rounded-lg border border-[#7bdcff] px-4 py-2 font-semibold text-[#7bdcff] hover:bg-[#7bdcff] hover:text-black disabled:opacity-40"
                >
                  Load Bingo Items
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="rounded-lg bg-[#7bdcff] px-4 py-2 font-semibold text-black disabled:opacity-40"
                >
                  Generate PDF
                </button>
              </div>

              {status && <p className="text-sm text-green-400">{status}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-6">
              <h2 className="text-lg font-semibold mb-2">Crate Summary</h2>
              <p className="text-white/60 text-sm">
                {items.length
                  ? `${items.length} eligible records loaded.`
                  : 'Load a crate to preview eligible records.'}
              </p>
              <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto">
                {items.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    className="text-sm border-b border-white/10 pb-2"
                  >
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-white/60">{item.artist}</div>
                  </div>
                ))}
                {items.length > 12 && (
                  <p className="text-xs text-white/40">
                    + {items.length - 12} more entries
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
