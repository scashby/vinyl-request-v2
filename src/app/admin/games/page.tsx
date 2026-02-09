"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
  { value: 'trivia-question', label: 'Trivia Question' },
  { value: 'track', label: 'Track' },
  { value: 'album', label: 'Album' },
  { value: 'bingo-item', label: 'Bingo Item' },
];

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'];

type LibraryItem = {
  id: number;
  game_type: string;
  item_type: string;
  title: string | null;
  artist: string | null;
  prompt: string | null;
  answer: string | null;
  cover_image: string | null;
  metadata: Json | null;
  created_at: string;
};

type InventoryResult = {
  inventoryId: number;
  releaseId: number | null;
  title: string;
  artist: string;
  coverImage: string | null;
  releaseYear: number | null;
  location: string | null;
};

type TrackResult = {
  id: number;
  recordingId: number | null;
  position: string;
  side: string | null;
  title: string;
  trackArtist: string | null;
};

const buildMetadata = (values: Record<string, Json | undefined>) => {
  const output: Record<string, Json> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return;
    output[key] = value;
  });
  return output;
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
  const [difficulty, setDifficulty] = useState('');
  const [notes, setNotes] = useState('');

  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryResults, setInventoryResults] = useState<InventoryResult[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [selectedInventory, setSelectedInventory] = useState<InventoryResult | null>(null);

  const [trackResults, setTrackResults] = useState<TrackResult[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

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

  const handleSearchInventory = async () => {
    setInventoryError('');
    setInventoryResults([]);

    if (!inventoryQuery.trim()) {
      setInventoryError('Enter a search term.');
      return;
    }

    setInventoryLoading(true);
    const response = await fetch(
      `/api/game-library/inventory-search?q=${encodeURIComponent(inventoryQuery.trim())}`
    );
    const result = await response.json();
    if (!response.ok) {
      setInventoryError(result.error || 'Failed to search collection.');
      setInventoryLoading(false);
      return;
    }

    setInventoryResults(result.data as InventoryResult[]);
    setInventoryLoading(false);
  };

  useEffect(() => {
    const loadTracks = async () => {
      if (!selectedInventory?.releaseId) {
        setTrackResults([]);
        setSelectedTrackId(null);
        return;
      }

      setTrackLoading(true);
      const response = await fetch(
        `/api/game-library/release-tracks?releaseId=${selectedInventory.releaseId}`
      );
      const result = await response.json();
      if (response.ok) {
        setTrackResults(result.data as TrackResult[]);
      }
      setTrackLoading(false);
    };

    loadTracks();
  }, [selectedInventory]);

  const selectedTrack = useMemo(
    () => trackResults.find((track) => track.id === selectedTrackId) ?? null,
    [trackResults, selectedTrackId]
  );

  const handleSelectInventory = (item: InventoryResult) => {
    setSelectedInventory(item);
    setArtist(item.artist);
    setTitle(item.title);
    setSelectedTrackId(null);
    if (!coverImage) {
      setCoverImage(item.coverImage ?? '');
    }
  };

  const handleSelectTrack = (trackId: number) => {
    if (!trackId || Number.isNaN(trackId)) {
      setSelectedTrackId(null);
      return;
    }
    setSelectedTrackId(trackId);
    const track = trackResults.find((item) => item.id === trackId);
    if (!track) return;
    setTitle(track.title);
    if (track.trackArtist) {
      setArtist(track.trackArtist);
    }
  };

  const handleCreate = async () => {
    setStatus('');
    setError('');

    const metadata = buildMetadata({
      difficulty: difficulty || undefined,
      notes: notes || undefined,
      source: selectedInventory ? 'collection' : 'manual',
      inventory_id: selectedInventory?.inventoryId,
      release_id: selectedInventory?.releaseId ?? undefined,
      track_position: selectedTrack?.position ?? undefined,
      track_side: selectedTrack?.side ?? undefined,
      recording_id: selectedTrack?.recordingId ?? undefined,
    });

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
        inventoryId: selectedInventory?.inventoryId ?? null,
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
    setDifficulty('');
    setNotes('');
    setSelectedInventory(null);
    setInventoryResults([]);
    setSelectedTrackId(null);
    setTrackResults([]);
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

  const filteredCountLabel = useMemo(() => {
    const activeFilters = [gameTypeFilter, itemTypeFilter, searchTerm].filter(Boolean).length;
    if (activeFilters === 0) return `Showing ${items.length} items`;
    return `Showing ${items.length} filtered items`;
  }, [items.length, gameTypeFilter, itemTypeFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <Container size="lg" className="py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Admin · Vinyl Games
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mt-2">Game Library</h1>
            <p className="text-sm text-slate-600 mt-2">
              Build reusable trivia questions, tracks, and bingo items from your collection.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/games/templates">
              <Button variant="secondary" size="sm">Manage Templates</Button>
            </Link>
            <Link href="/admin/games/sessions">
              <Button variant="secondary" size="sm">Open Game Sessions</Button>
            </Link>
            <Link href="/admin/games/bingo">
              <Button variant="secondary" size="sm">Print Bingo Cards</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Add library item</h2>
                  <p className="text-sm text-slate-500">Choose from your collection or enter manually.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                    value={itemType}
                    onChange={(event) => setItemType(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    {ITEM_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Pull from collection</h3>
                    <p className="text-xs text-slate-500">Search by artist or album to auto-fill details.</p>
                  </div>
                  {selectedInventory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedInventory(null);
                        setTrackResults([]);
                        setSelectedTrackId(null);
                      }}
                    >
                      Clear selection
                    </Button>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <input
                    value={inventoryQuery}
                    onChange={(event) => setInventoryQuery(event.target.value)}
                    placeholder="Search artist or album"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                  <Button onClick={handleSearchInventory} size="sm">
                    Search
                  </Button>
                </div>

                {inventoryLoading && (
                  <p className="mt-2 text-xs text-slate-500">Searching collection...</p>
                )}
                {inventoryError && (
                  <p className="mt-2 text-xs text-red-600">{inventoryError}</p>
                )}

                {inventoryResults.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {inventoryResults.map((item) => (
                      <button
                        key={item.inventoryId}
                        type="button"
                        onClick={() => handleSelectInventory(item)}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-blue-400"
                      >
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                          {item.coverImage ? (
                            <Image
                              src={item.coverImage}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="h-full w-full bg-slate-200" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500">
                            {item.artist}
                            {item.releaseYear ? ` · ${item.releaseYear}` : ''}
                            {item.location ? ` · ${item.location}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedInventory && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <div className="font-semibold">Selected from collection</div>
                    <div>
                      {selectedInventory.artist} — {selectedInventory.title}
                    </div>
                    {selectedInventory.location && (
                      <div className="text-xs text-blue-700">Location: {selectedInventory.location}</div>
                    )}
                  </div>
                )}

                {selectedInventory && (
                  <div className="mt-3">
                    <label className="text-sm font-medium text-slate-700">Track (optional)</label>
                    <select
                      value={selectedTrackId ?? ''}
                      onChange={(event) => handleSelectTrack(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Use album title</option>
                      {trackResults.map((track) => (
                        <option key={track.id} value={track.id}>
                          {track.side ? `${track.side} ` : ''}{track.position} · {track.title}
                        </option>
                      ))}
                    </select>
                    {trackLoading && (
                      <p className="mt-2 text-xs text-slate-500">Loading track list...</p>
                    )}
                  </div>
                )}
              </div>

              {shouldShowTriviaFields && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="Name the sample, identify the artist, etc."
                  />
                </div>
              )}

              {shouldShowTriviaFields && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Answer</label>
                  <input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="Correct answer or response"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Artist</label>
                  <input
                    value={artist}
                    onChange={(event) => setArtist(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="Artist name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="Track or album title"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Cover image URL</label>
                <input
                  value={coverImage}
                  onChange={(event) => setCoverImage(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="">Select</option>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <input
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="Optional hint or notes"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleCreate}>Add to Library</Button>
                {status && <span className="text-sm text-green-600">{status}</span>}
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Library items</h2>
                <p className="text-xs text-slate-500 mt-1">{filteredCountLabel}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => fetchItems()}>
                Refresh
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={gameTypeFilter}
                onChange={(event) => setGameTypeFilter(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm"
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
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm"
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
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={() => fetchItems()}>
                Apply Filters
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setGameTypeFilter('');
                  setItemTypeFilter('');
                  setSearchTerm('');
                  fetchItems({ gameType: '', itemType: '', search: '' });
                }}
              >
                Clear
              </Button>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto">
              {loading && <p className="text-sm text-slate-500">Loading items...</p>}
              {!loading && items.length === 0 && (
                <p className="text-sm text-slate-500">No library items yet. Add one to get started.</p>
              )}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {item.game_type} · {item.item_type}
                  </div>
                  <div className="mt-2 font-semibold">
                    {item.prompt || item.title || 'Untitled item'}
                  </div>
                  {(item.artist || item.title) && (
                    <div className="text-sm text-slate-500">
                      {item.artist ? `${item.artist} — ` : ''}{item.title}
                    </div>
                  )}
                  {item.answer && (
                    <div className="text-xs text-slate-400 mt-2">Answer: {item.answer}</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </Button>
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
