"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from 'components/ui/Button';
import { Card } from 'components/ui/Card';
import { Container } from 'components/ui/Container';
import type { Json } from 'types/supabase';

const GAME_TYPE_OPTIONS = [
  { value: 'trivia', label: 'Needle Drop Trivia' },
  { value: 'bingo', label: 'Vinyl Bingo' },
  { value: 'bracketology', label: 'Bracketology' },
];

const ITEM_TYPE_OPTIONS = [
  { value: 'trivia-question', label: 'Trivia Question', gameTypes: ['trivia'] },
  { value: 'bingo-item', label: 'Bingo Item', gameTypes: ['bingo'] },
  { value: 'track', label: 'Track', gameTypes: ['bracketology'] },
  { value: 'album', label: 'Album', gameTypes: ['bracketology'] },
];

type TemplateRow = {
  id: number;
  name: string;
  game_type: string;
  template_state: Json;
  created_at: string;
  items_count?: number;
};

type LibraryItem = {
  id: number;
  game_type: string;
  item_type: string;
  title: string | null;
  artist: string | null;
  prompt: string | null;
  answer: string | null;
  cover_image: string | null;
  tags: string[] | null;
  genres: string[] | null;
  decades: string[] | null;
  metadata: Json | null;
};

export default function GameTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState('trivia');
  const [itemType, setItemType] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [decadeFilter, setDecadeFilter] = useState('');

  const availableItemTypes = useMemo(
    () => ITEM_TYPE_OPTIONS.filter((option) => option.gameTypes.includes(gameType)),
    [gameType]
  );

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as LibraryItem[],
    [selectedIds, items]
  );

  const loadTemplates = async () => {
    const response = await fetch('/api/game-templates');
    const result = await response.json();
    if (response.ok) {
      setTemplates(result.data as TemplateRow[]);
    }
  };

  const fetchItems = useCallback(async () => {
    if (!itemType) return;
    const params = new URLSearchParams();
    params.set('gameType', gameType);
    params.set('itemType', itemType);
    if (query.trim()) params.set('q', query.trim());
    if (tagFilter.trim()) params.set('tags', tagFilter.trim());
    if (genreFilter.trim()) params.set('genres', genreFilter.trim());
    if (decadeFilter.trim()) params.set('decades', decadeFilter.trim());

    const response = await fetch(`/api/game-library?${params.toString()}`);
    const result = await response.json();
    if (response.ok) {
      setItems(result.data as LibraryItem[]);
    }
  }, [decadeFilter, gameType, genreFilter, itemType, query, tagFilter]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const nextItemType = availableItemTypes[0]?.value ?? '';
    setItemType((prev) => {
      if (prev && availableItemTypes.some((opt) => opt.value === prev)) return prev;
      return nextItemType;
    });
    setSelectedIds([]);
  }, [gameType, availableItemTypes]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const moveSelected = (id: number, direction: -1 | 1) => {
    setSelectedIds((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSaveTemplate = async () => {
    setStatus('');
    setError('');

    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    if (selectedIds.length === 0) {
      setError('Select at least one library item.');
      return;
    }

    const itemPositions = selectedIds.reduce<Record<string, number>>((acc, id, index) => {
      acc[String(id)] = index + 1;
      return acc;
    }, {});

    const response = await fetch('/api/game-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        gameType,
        templateState: {},
        itemIds: selectedIds,
        itemPositions,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to create template.');
      return;
    }

    setStatus('Template created.');
    setName('');
    setSelectedIds([]);
    await loadTemplates();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <Container size="lg" className="py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Admin · Vinyl Games</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-2">Game Templates</h1>
            <p className="text-sm text-slate-600 mt-2">
              Build curated game sets from the library for Trivia, Bingo, and Bracketology.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/games">
              <Button variant="secondary" size="sm">Open Game Library</Button>
            </Link>
            <Link href="/admin/games/sessions">
              <Button variant="secondary" size="sm">Manage Sessions</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Create template</h2>
                <p className="text-sm text-slate-500">Select items and save the order as a reusable template.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Template name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  placeholder="Friday Trivia Set 1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Game type</label>
                <select
                  value={gameType}
                  onChange={(event) => setGameType(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  {GAME_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Item type</label>
                <select
                  value={itemType || availableItemTypes[0]?.value || ''}
                  onChange={(event) => setItemType(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  {availableItemTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <Card className="bg-white">
                <div className="text-xs uppercase tracking-widest text-slate-500">Filter library</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, artist, prompt"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  <input
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    placeholder="Tags (comma separated)"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  <input
                    value={genreFilter}
                    onChange={(event) => setGenreFilter(event.target.value)}
                    placeholder="Genres (comma separated)"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  <input
                    value={decadeFilter}
                    onChange={(event) => setDecadeFilter(event.target.value)}
                    placeholder="Decades (e.g. 1970s)"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={fetchItems}>Apply Filters</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery('');
                      setTagFilter('');
                      setGenreFilter('');
                      setDecadeFilter('');
                      fetchItems();
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </Card>

              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {items.length === 0 && (
                  <p className="text-sm text-slate-500">No library items match these filters.</p>
                )}
                {items.map((item) => (
                  <label key={item.id} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-semibold">
                        {item.prompt || item.title || 'Untitled item'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.artist ? `${item.artist} — ` : ''}{item.title}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500">Selected order</div>
                <div className="mt-2 space-y-2">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                      <div>
                        <div className="font-semibold">{item.prompt || item.title}</div>
                        <div className="text-xs text-slate-500">{item.artist}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => moveSelected(item.id, -1)}>Up</Button>
                        <Button size="sm" variant="secondary" onClick={() => moveSelected(item.id, 1)}>Down</Button>
                      </div>
                    </div>
                  ))}
                  {selectedItems.length === 0 && (
                    <p className="text-sm text-slate-500">Select items to build the template order.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveTemplate}>Save Template</Button>
                {status && <span className="text-sm text-green-600">{status}</span>}
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </Card>
          </div>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold">Saved templates</h2>
            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {templates.length === 0 && (
                <p className="text-sm text-slate-500">No templates yet.</p>
              )}
              {templates.map((template) => (
                <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {template.game_type}
                  </div>
                  <div className="mt-2 font-semibold">{template.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {template.items_count ?? 0} items · {new Date(template.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Container>
    </div>
  );
}
