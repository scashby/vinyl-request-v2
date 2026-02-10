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
  { value: 'trivia-question', label: 'Trivia Question', gameTypes: ['trivia'] },
  { value: 'track', label: 'Track', gameTypes: ['bracketology'] },
  { value: 'album', label: 'Album', gameTypes: ['bracketology'] },
  { value: 'bingo-item', label: 'Bingo Item', gameTypes: ['bingo'] },
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
  tags: string[] | null;
  genres: string[] | null;
  decades: string[] | null;
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
  mediaType?: string | null;
  label?: string | null;
  catalogNumber?: string | null;
  genres?: string[] | null;
  styles?: string[] | null;
  musicians?: string[] | null;
  producers?: string[] | null;
  engineers?: string[] | null;
  songwriters?: string[] | null;
  composer?: string | null;
  conductor?: string | null;
  chorus?: string | null;
  orchestra?: string | null;
  recordingYear?: number | null;
  recordingLocation?: string | null;
  awards?: string[] | null;
  certifications?: string[] | null;
  chartPositions?: string[] | null;
  allmusicRating?: number | null;
  pitchforkScore?: number | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
  trackPosition?: string | null;
  trackSide?: string | null;
  recordingId?: number | null;
};

type TrackResult = {
  id: number;
  recordingId: number | null;
  position: string;
  side: string | null;
  title: string;
  trackArtist: string | null;
  credits?: Json | null;
  lyrics?: string | null;
  lyricsUrl?: string | null;
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
  const [answerSource, setAnswerSource] = useState('');
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const [answerMeta, setAnswerMeta] = useState<Record<string, Json>>({});
  const [bingoSlot, setBingoSlot] = useState('');
  const [bracketSeed, setBracketSeed] = useState('');

  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryResults, setInventoryResults] = useState<InventoryResult[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [selectedInventory, setSelectedInventory] = useState<InventoryResult | null>(null);

  const [trackResults, setTrackResults] = useState<TrackResult[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [derivedTags, setDerivedTags] = useState<string[]>([]);
  const [derivedGenres, setDerivedGenres] = useState<string[]>([]);
  const [derivedDecades, setDerivedDecades] = useState<string[]>([]);

  const availableItemTypes = ITEM_TYPE_OPTIONS.filter((option) =>
    option.gameTypes.includes(gameType)
  );
  const shouldShowTriviaFields = itemType === 'trivia-question';
  const shouldShowDifficulty = itemType === 'trivia-question';
  const shouldShowBingoFields = itemType === 'bingo-item';
  const shouldShowBracketFields = itemType === 'track' || itemType === 'album';

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

  useEffect(() => {
    if (!availableItemTypes.find((option) => option.value === itemType)) {
      setItemType(availableItemTypes[0]?.value ?? 'trivia-question');
    }
  }, [availableItemTypes, itemType]);

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
    setCoverImage(item.coverImage ?? '');
    setPrompt('');
    setAnswer('');
    setAnswerSource('');
    setSuggestedPrompt('');
    setAnswerMeta({});
    setDifficulty('');
    setNotes('');
    setBingoSlot('');
    setBracketSeed('');
    if (item.trackTitle) {
      setTitle(item.trackTitle);
    }
    if (item.trackArtist) {
      setArtist(item.trackArtist);
    }

    const combinedGenres = [
      ...(item.genres ?? []),
      ...(item.styles ?? []),
    ].filter(Boolean);
    setDerivedGenres(combinedGenres);

    const decadeSource = item.releaseYear ?? item.recordingYear ?? null;
    const decadeLabel =
      typeof decadeSource === 'number'
        ? `${Math.floor(decadeSource / 10) * 10}s`
        : null;
    setDerivedDecades(decadeLabel ? [decadeLabel] : []);

    const baseTags = [
      item.mediaType ? `format:${item.mediaType}` : null,
      item.label ? `label:${item.label}` : null,
    ].filter(Boolean) as string[];
    setDerivedTags(baseTags);
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

  const trackCreditOptions = useMemo(() => {
    const track = trackResults.find((item) => item.id === selectedTrackId);
    const credits = track?.credits;
    if (!credits || !Array.isArray(credits)) return [];
    return credits
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, Json | undefined>;
        const name = String(record.name ?? record.artist ?? record.person ?? '').trim();
        const role = String(record.role ?? record.instrument ?? record.job ?? '').trim();
        if (!name) return null;
        return role ? `${name} (${role})` : name;
      })
      .filter(Boolean) as string[];
  }, [selectedTrackId, trackResults]);

  const contributorOptions = useMemo(() => {
    if (!selectedInventory) return [];
    return [
      ...(selectedInventory.musicians ?? []).map((name) => `${name} (Musician)`),
      ...(selectedInventory.producers ?? []).map((name) => `${name} (Producer)`),
      ...(selectedInventory.engineers ?? []).map((name) => `${name} (Engineer)`),
      ...(selectedInventory.songwriters ?? []).map((name) => `${name} (Songwriter)`),
      ...(selectedInventory.composer ? [`${selectedInventory.composer} (Composer)`] : []),
      ...(selectedInventory.conductor ? [`${selectedInventory.conductor} (Conductor)`] : []),
      ...(selectedInventory.chorus ? [`${selectedInventory.chorus} (Chorus)`] : []),
      ...(selectedInventory.orchestra ? [`${selectedInventory.orchestra} (Orchestra)`] : []),
    ];
  }, [selectedInventory]);

  const answerSources = useMemo(() => {
    if (!selectedInventory) return [];
    const options: Array<{
      value: string;
      label: string;
      answer: string;
      prompt: string;
      meta: Record<string, Json>;
    }> = [];

    const albumLabel = `${selectedInventory.artist} — ${selectedInventory.title}`;
    options.push({
      value: 'album',
      label: 'Album title',
      answer: selectedInventory.title,
      prompt: `What is the album title for "${selectedInventory.artist}"?`,
      meta: { answer_source: 'album' },
    });
    options.push({
      value: 'artist',
      label: 'Artist name',
      answer: selectedInventory.artist,
      prompt: `Who is the artist behind "${selectedInventory.title}"?`,
      meta: { answer_source: 'artist' },
    });
    if (selectedInventory.coverImage) {
      options.push({
        value: 'cover_art',
        label: 'Cover art (album)',
        answer: albumLabel,
        prompt: 'Which album cover is this?',
        meta: { answer_source: 'cover_art' },
      });
    }
    if (selectedInventory.releaseYear) {
      options.push({
        value: 'release_year',
        label: 'Release year',
        answer: String(selectedInventory.releaseYear),
        prompt: `What year was "${selectedInventory.title}" released?`,
        meta: { answer_source: 'release_year', release_year: selectedInventory.releaseYear },
      });
    }
    if (selectedInventory.label) {
      options.push({
        value: 'label',
        label: 'Label',
        answer: selectedInventory.label,
        prompt: `Which label released "${selectedInventory.title}"?`,
        meta: { answer_source: 'label', label: selectedInventory.label },
      });
    }
    if (selectedInventory.catalogNumber) {
      options.push({
        value: 'catalog_number',
        label: 'Catalog number',
        answer: selectedInventory.catalogNumber,
        prompt: `What catalog number is associated with "${selectedInventory.title}"?`,
        meta: { answer_source: 'catalog_number', catalog_number: selectedInventory.catalogNumber },
      });
    }
    if (selectedInventory.genres?.length) {
      options.push({
        value: 'genre',
        label: 'Genre',
        answer: selectedInventory.genres[0],
        prompt: `Which genre best fits "${selectedInventory.title}"?`,
        meta: { answer_source: 'genre', genre: selectedInventory.genres[0] },
      });
    }
    if (selectedInventory.styles?.length) {
      options.push({
        value: 'style',
        label: 'Style',
        answer: selectedInventory.styles[0],
        prompt: `Which style best fits "${selectedInventory.title}"?`,
        meta: { answer_source: 'style', style: selectedInventory.styles[0] },
      });
    }
    if (selectedInventory.recordingLocation) {
      options.push({
        value: 'recording_location',
        label: 'Recording location',
        answer: selectedInventory.recordingLocation,
        prompt: `Where was "${selectedInventory.title}" recorded?`,
        meta: { answer_source: 'recording_location', recording_location: selectedInventory.recordingLocation },
      });
    }
    if (selectedInventory.awards?.length) {
      options.push({
        value: 'award',
        label: 'Award',
        answer: selectedInventory.awards[0],
        prompt: `Name an award won by "${selectedInventory.title}".`,
        meta: { answer_source: 'award', award: selectedInventory.awards[0] },
      });
    }
    if (selectedInventory.certifications?.length) {
      options.push({
        value: 'certification',
        label: 'Certification',
        answer: selectedInventory.certifications[0],
        prompt: `What certification did "${selectedInventory.title}" receive?`,
        meta: { answer_source: 'certification', certification: selectedInventory.certifications[0] },
      });
    }
    if (selectedInventory.chartPositions?.length) {
      options.push({
        value: 'chart_position',
        label: 'Chart position',
        answer: selectedInventory.chartPositions[0],
        prompt: `What chart position is associated with "${selectedInventory.title}"?`,
        meta: { answer_source: 'chart_position', chart_position: selectedInventory.chartPositions[0] },
      });
    }
    if (selectedInventory.allmusicRating !== null && selectedInventory.allmusicRating !== undefined) {
      options.push({
        value: 'allmusic_rating',
        label: 'AllMusic rating',
        answer: String(selectedInventory.allmusicRating),
        prompt: `What is the AllMusic rating for "${selectedInventory.title}"?`,
        meta: { answer_source: 'allmusic_rating', allmusic_rating: selectedInventory.allmusicRating },
      });
    }
    if (selectedInventory.pitchforkScore !== null && selectedInventory.pitchforkScore !== undefined) {
      options.push({
        value: 'pitchfork_score',
        label: 'Pitchfork score',
        answer: String(selectedInventory.pitchforkScore),
        prompt: `What is the Pitchfork score for "${selectedInventory.title}"?`,
        meta: { answer_source: 'pitchfork_score', pitchfork_score: selectedInventory.pitchforkScore },
      });
    }
    if (selectedTrack) {
      options.push({
        value: 'track_title',
        label: 'Track title',
        answer: selectedTrack.title,
        prompt: `Name the track from "${selectedInventory.title}".`,
        meta: { answer_source: 'track_title', track_title: selectedTrack.title },
      });
      if (selectedTrack.position) {
        const sideLabel = selectedTrack.side ? `${selectedTrack.side} ` : '';
        options.push({
          value: 'track_position',
          label: 'Track position',
          answer: selectedTrack.title,
          prompt: `Which track is on ${sideLabel}${selectedTrack.position}?`,
          meta: { answer_source: 'track_position', track_position: selectedTrack.position },
        });
      }
    }
    if (contributorOptions.length) {
      contributorOptions.forEach((option) => {
        const [name, rolePart] = option.split(' (');
        const role = rolePart ? rolePart.replace(')', '') : 'Contributor';
        options.push({
          value: `contributor:${option}`,
          label: `Contributor · ${option}`,
          answer: name,
          prompt: `Which ${role.toLowerCase()} appears on "${selectedInventory.title}" by ${selectedInventory.artist}?`,
          meta: { answer_source: 'contributor', contributor: option },
        });
      });
    }
    if (trackCreditOptions.length) {
      trackCreditOptions.forEach((option) => {
        const [name, rolePart] = option.split(' (');
        const role = rolePart ? rolePart.replace(')', '') : 'credit';
        options.push({
          value: `track_credit:${option}`,
          label: `Track credit · ${option}`,
          answer: name,
          prompt: `Which ${role.toLowerCase()} appears on the track "${selectedTrack?.title ?? ''}"?`,
          meta: { answer_source: 'track_credit', track_credit: option },
        });
      });
    }

    return options.filter((option) => option.answer?.trim());
  }, [selectedInventory, selectedTrack, contributorOptions, trackCreditOptions]);

  const handleCreate = async () => {
    setStatus('');
    setError('');
    if (!selectedInventory) {
      setError('Select an item from your collection first.');
      return;
    }

    const metadata = buildMetadata({
      difficulty: shouldShowDifficulty ? difficulty || undefined : undefined,
      notes: notes || undefined,
      source: selectedInventory ? 'collection' : 'manual',
      inventory_id: selectedInventory?.inventoryId,
      release_id: selectedInventory?.releaseId ?? undefined,
      track_position: selectedTrack?.position ?? selectedInventory?.trackPosition ?? undefined,
      track_side: selectedTrack?.side ?? selectedInventory?.trackSide ?? undefined,
      recording_id: selectedTrack?.recordingId ?? selectedInventory?.recordingId ?? undefined,
      track_title: selectedTrack?.title ?? selectedInventory?.trackTitle ?? undefined,
      genre: selectedInventory?.genres?.[0] ?? undefined,
      style: selectedInventory?.styles?.[0] ?? undefined,
      bingo_slot: shouldShowBingoFields && bingoSlot ? Number(bingoSlot) : undefined,
      seed: shouldShowBracketFields && bracketSeed ? Number(bracketSeed) : undefined,
      ...answerMeta,
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
        tags: derivedTags,
        genres: derivedGenres,
        decades: derivedDecades,
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
    setAnswerSource('');
    setSuggestedPrompt('');
    setAnswerMeta({});
    setBingoSlot('');
    setBracketSeed('');
    setDerivedTags([]);
    setDerivedGenres([]);
    setDerivedDecades([]);
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
                  {availableItemTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Item types are filtered by the selected game type.
                </p>
                </div>
              </div>

              {shouldShowTriviaFields && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Step 1 · Write the trivia question</label>
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {shouldShowTriviaFields ? 'Step 2 · Choose from your collection' : 'Choose from your collection'}
                    </h3>
                    <p className="text-xs text-slate-500">Search by artist, album, or track and select the correct record.</p>
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
                    placeholder="Search artist, album, or track"
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
                          {item.trackTitle && (
                            <div className="text-xs text-blue-600">
                              Track: {item.trackSide ? `${item.trackSide} ` : ''}{item.trackPosition ?? ''} {item.trackTitle}
                            </div>
                          )}
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
                    {selectedInventory.trackTitle && (
                      <div className="text-xs text-blue-700">
                        Track: {selectedInventory.trackSide ? `${selectedInventory.trackSide} ` : ''}{selectedInventory.trackPosition ?? ''} {selectedInventory.trackTitle}
                        {selectedInventory.trackArtist ? ` · ${selectedInventory.trackArtist}` : ''}
                      </div>
                    )}
                    {selectedInventory.location && (
                      <div className="text-xs text-blue-700">Location: {selectedInventory.location}</div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-blue-700">
                      {selectedInventory.releaseYear && <span>Year: {selectedInventory.releaseYear}</span>}
                      {selectedInventory.mediaType && <span>Format: {selectedInventory.mediaType}</span>}
                      {selectedInventory.label && <span>Label: {selectedInventory.label}</span>}
                      {selectedInventory.catalogNumber && <span>Cat #: {selectedInventory.catalogNumber}</span>}
                    </div>
                    {(derivedGenres.length > 0 || derivedDecades.length > 0 || derivedTags.length > 0) && (
                      <div className="mt-2 text-xs text-blue-700">
                        {derivedGenres.length > 0 && (
                          <div>Genres: {derivedGenres.join(', ')}</div>
                        )}
                        {derivedDecades.length > 0 && (
                          <div>Decades: {derivedDecades.join(', ')}</div>
                        )}
                        {derivedTags.length > 0 && (
                          <div>Tags: {derivedTags.join(', ')}</div>
                        )}
                        {selectedInventory.recordingLocation && (
                          <div>Recording location: {selectedInventory.recordingLocation}</div>
                        )}
                        {selectedInventory.awards?.length ? (
                          <div>Awards: {selectedInventory.awards.join(', ')}</div>
                        ) : null}
                        {selectedInventory.certifications?.length ? (
                          <div>Certifications: {selectedInventory.certifications.join(', ')}</div>
                        ) : null}
                        {selectedInventory.chartPositions?.length ? (
                          <div>Chart positions: {selectedInventory.chartPositions.join(', ')}</div>
                        ) : null}
                        {selectedInventory.allmusicRating !== null && selectedInventory.allmusicRating !== undefined ? (
                          <div>AllMusic rating: {selectedInventory.allmusicRating}</div>
                        ) : null}
                        {selectedInventory.pitchforkScore !== null && selectedInventory.pitchforkScore !== undefined ? (
                          <div>Pitchfork score: {selectedInventory.pitchforkScore}</div>
                        ) : null}
                      </div>
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

                {selectedInventory && shouldShowTriviaFields && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-500">Step 3 · Choose the answer data</div>
                    <label className="mt-3 text-sm font-medium text-slate-700 block">Answer source</label>
                    <select
                      value={answerSource}
                      onChange={(event) => {
                        const next = event.target.value;
                        setAnswerSource(next);
                        const option = answerSources.find((entry) => entry.value === next);
                        if (option) {
                          setAnswer(option.answer);
                          setSuggestedPrompt(option.prompt);
                          setAnswerMeta(option.meta);
                        } else {
                          setSuggestedPrompt('');
                          setAnswerMeta({});
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Select what the answer should be</option>
                      {answerSources.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {suggestedPrompt && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="font-semibold text-slate-700">Suggested prompt</div>
                        <div className="mt-1">{suggestedPrompt}</div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-2"
                          onClick={() => setPrompt(suggestedPrompt)}
                        >
                          Use suggested prompt
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {shouldShowBingoFields && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Bingo slot (optional)</label>
                  <select
                    value={bingoSlot}
                    onChange={(event) => setBingoSlot(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="">No fixed slot</option>
                    {Array.from({ length: 25 }, (_, index) => index + 1).map((slot) => (
                      <option key={slot} value={slot} disabled={slot === 13}>
                        {slot === 13 ? '13 · Free space' : `Slot ${slot}`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Slot 13 is the free space. This is used when building a fixed bingo template.
                  </p>
                </div>
              )}

              {shouldShowBracketFields && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Seed (optional)</label>
                  <input
                    value={bracketSeed}
                    onChange={(event) => setBracketSeed(event.target.value)}
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
                    placeholder="1 = highest seed"
                  />
                </div>
              )}

              {selectedInventory && (
                <div className="grid gap-4 md:grid-cols-[120px_1fr] items-center rounded-xl border border-gray-200 bg-white p-3">
                  <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-slate-100">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={title || 'Cover image'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-200" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Selected details</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {artist} — {title}
                    </div>
                    {selectedInventory.trackTitle && (
                      <div className="text-xs text-slate-500">
                        Track: {selectedInventory.trackSide ? `${selectedInventory.trackSide} ` : ''}{selectedInventory.trackPosition ?? ''} {selectedInventory.trackTitle}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={`grid gap-4 ${shouldShowDifficulty ? 'md:grid-cols-2' : ''}`}>
                {shouldShowDifficulty && (
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
                )}
                <div>
                  <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
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
