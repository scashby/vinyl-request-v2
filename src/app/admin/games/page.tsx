"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Container } from 'components/ui/Container';

const GAME_TYPE_OPTIONS = [
  { value: 'trivia', label: 'Needle Drop Trivia' },
  { value: 'bingo', label: 'Vinyl Bingo' },
  { value: 'bracketology', label: 'Bracketology' },
];

const ITEM_TYPE_OPTIONS = [
  { value: 'trivia-question', label: 'Trivia Question' },
  { value: 'track', label: 'Track' },
  { value: 'album', label: 'Album' },
  { value: 'bingo-item', label: 'Bingo Item' },
];

type LibraryItem = {
  id: number;
  game_type: string;
  item_type: string;
  title: string | null;
  artist: string | null;
  prompt: string | null;
  answer: string | null;
  cover_image: string | null;
  metadata: unknown;
  created_at: string;
};

export default function GameLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [gameTypeFilter, setGameTypeFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [gameType, setGameType] = useState('trivia');
  const [itemType, setItemType] = useState('trivia-question');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [metadataJson, setMetadataJson] = useState('');

  const shouldShowTriviaFields = itemType === 'trivia-question';

  const fetchItems = async (overrides?: {
    gameType?: string;
    itemType?: string;
    search?: string;
  }) => {
    setLoading(true);
    const params = new URLSearchParams();
    const nextGameType = overrides?.gameType ?? gameTypeFilter;
    const nextItemType = overrides?.itemType ?? itemTypeFilter;
    const nextSearch = overrides?.search ?? searchTerm;

    if (nextGameType) params.set('gameType', nextGameType);
    if (nextItemType) params.set('itemType', nextItemType);
    if (nextSearch) params.set('q', nextSearch);

    const response = await fetch(`/api/game-library?${params.toString()}`);
    const result = await response.json();
    if (response.ok) {
      setItems(result.data as LibraryItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const loadInitialItems = async () => {
      setLoading(true);
      const response = await fetch('/api/game-library');
      const result = await response.json();
      if (response.ok) {
        setItems(result.data as LibraryItem[]);
      }
      setLoading(false);
    };

    loadInitialItems();
  }, []);

  const handleCreate = async () => {
    setStatus('');
    setError('');

    let metadata: unknown = {};
    if (metadataJson.trim()) {
      try {
        metadata = JSON.parse(metadataJson.trim());
      } catch {
        setError('Metadata JSON is invalid.');
        return;
      }
    }

    const response = await fetch('/api/game-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameType,
        itemType,
        title: title.trim() || null,
        artist: artist.trim() || null,
        prompt: prompt.trim() || null,
        answer: answer.trim() || null,
        coverImage: coverImage.trim() || null,
        metadata,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to add library item.');
      return;
    }

    setStatus('Library item added.');
    setTitle('');
    setArtist('');
    setPrompt('');
    setAnswer('');
    setCoverImage('');
    setMetadataJson('');
    await fetchItems();
  };

  const handleDelete = async (itemId: number) => {
    setStatus('');
    setError('');
    const confirmed = window.confirm('Remove this library item?');
    if (!confirmed) return;

    const response = await fetch(`/api/game-library/${itemId}`, {
      method: 'DELETE',
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.error || 'Failed to remove item.');
      return;
    }

    setStatus('Library item removed.');
    await fetchItems();
  };

  const copyJson = async (item: LibraryItem) => {
    const payload = {
      gameType: item.game_type,
      itemType: item.item_type,
      title: item.title ?? '',
      artist: item.artist ?? '',
      prompt: item.prompt ?? '',
      answer: item.answer ?? '',
      coverImage: item.cover_image ?? '',
      metadata: item.metadata ?? {},
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus('Copied item JSON to clipboard.');
    } catch {
      setError('Failed to copy JSON.');
    }
  };

  const filteredCountLabel = useMemo(() => {
    const activeFilters = [gameTypeFilter, itemTypeFilter, searchTerm].filter(Boolean).length;
    if (activeFilters === 0) return `Showing ${items.length} items`;
    return `Showing ${items.length} filtered items`;
  }, [items.length, gameTypeFilter, itemTypeFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Container size="lg">
        <div className="py-12">
          <p className="text-sm uppercase tracking-[0.35em] text-[#7bdcff]">
            Admin · Vinyl Games
          </p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">
            Game Library
          </h1>
          <p className="text-white/60 mt-2">
            Build reusable trivia questions, tracks, and bingo items for your game prep.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/games/templates"
              className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20"
            >
              Manage Templates
            </Link>
            <Link
              href="/admin/games/sessions"
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold hover:border-white/40"
            >
              Open Game Sessions
            </Link>
            <Link
              href="/admin/games/bingo"
              className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold hover:border-white/40"
            >
              Print Bingo Cards
            </Link>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <h2 className="text-lg font-semibold">Add library item</h2>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Game type</label>
                  <select
                    value={gameType}
                    onChange={(event) => setGameType(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  >
                    {GAME_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Item type</label>
                  <select
                    value={itemType}
                    onChange={(event) => setItemType(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  >
                    {ITEM_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {shouldShowTriviaFields && (
                <>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Prompt</label>
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                      placeholder="Name the sample, identify the artist, etc."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Answer</label>
                    <input
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                      placeholder="Correct answer or response"
                    />
                  </div>
                </>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Artist</label>
                  <input
                    value={artist}
                    onChange={(event) => setArtist(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                    placeholder="Artist name"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-2 block">Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                    placeholder="Track or album title"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Cover image URL</label>
                <input
                  value={coverImage}
                  onChange={(event) => setCoverImage(event.target.value)}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Metadata (JSON)</label>
                <textarea
                  value={metadataJson}
                  onChange={(event) => setMetadataJson(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-black/60 border border-white/10 px-4 py-3 text-white font-mono text-xs"
                  placeholder='{"difficulty":"medium","notes":"Intro riff"}'
                />
              </div>

              <button
                type="button"
                onClick={handleCreate}
                className="rounded-lg bg-[#7bdcff] px-4 py-2 font-semibold text-black"
              >
                Add to Library
              </button>

              {status && <p className="text-sm text-green-400">{status}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0c0f1a] p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Library items</h2>
                  <p className="text-xs text-white/60 mt-1">{filteredCountLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchItems()}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs font-semibold hover:border-white/40"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <select
                  value={gameTypeFilter}
                  onChange={(event) => setGameTypeFilter(event.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="">All game types</option>
                  {GAME_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={itemTypeFilter}
                  onChange={(event) => setItemTypeFilter(event.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white"
                >
                  <option value="">All item types</option>
                  {ITEM_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search"
                  className="rounded-lg bg-black/60 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => fetchItems()}
                  className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameTypeFilter('');
                    setItemTypeFilter('');
                    setSearchTerm('');
                    fetchItems({ gameType: '', itemType: '', search: '' });
                  }}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs font-semibold hover:border-white/40"
                >
                  Clear
                </button>
              </div>

              <div className="mt-6 space-y-3 max-h-[520px] overflow-y-auto">
                {loading && (
                  <p className="text-sm text-white/60">Loading items...</p>
                )}
                {!loading && items.length === 0 && (
                  <p className="text-sm text-white/60">
                    No library items yet. Add one to get started.
                  </p>
                )}
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-black/40 p-4"
                  >
                    <div className="text-xs uppercase tracking-widest text-white/60">
                      {item.game_type} · {item.item_type}
                    </div>
                    <div className="mt-2 font-semibold">
                      {item.prompt || item.title || 'Untitled item'}
                    </div>
                    {(item.artist || item.title) && (
                      <div className="text-sm text-white/60">
                        {item.artist ? `${item.artist} — ` : ''}{item.title}
                      </div>
                    )}
                    {item.answer && (
                      <div className="text-xs text-white/50 mt-2">
                        Answer: {item.answer}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyJson(item)}
                        className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20"
                      >
                        Copy JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md border border-red-400/40 px-3 py-1 text-xs font-semibold text-red-300 hover:border-red-400"
                      >
                        Delete
                      </button>
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
