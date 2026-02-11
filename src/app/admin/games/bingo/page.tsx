"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type SearchTrack = {
  inventory_id: number;
  recording_id: number | null;
  title: string;
  artist: string;
  year: number | null;
  side: string | null;
  position: string | null;
};

type PlaylistTrack = {
  id: string;
  title: string;
  artist: string;
  year: string;
};

const EXPORT_COLUMNS = ["Rank", "Artist", "Title", "Year"];

function escapeCsv(value: string): string {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function makeTrackId() {
  return `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function Page() {
  const [playlistName, setPlaylistName] = useState("Rockstar Import Playlist");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchTrack[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<PlaylistTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/vinyl-search?q=${encodeURIComponent(trimmed)}`);
        const payload = await response.json();
        if (!response.ok) {
          setSearchError(payload.error ?? "Search failed.");
          return;
        }
        setSearchResults(payload.data ?? []);
      } catch {
        setSearchError("Search failed.");
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const selectedLookup = useMemo(() => {
    const map = new Set<string>();
    for (const track of selectedTracks) {
      map.add(`${track.artist.toLowerCase()}::${track.title.toLowerCase()}::${track.year}`);
    }
    return map;
  }, [selectedTracks]);

  const addTrack = (track: SearchTrack) => {
    const key = `${track.artist.toLowerCase()}::${track.title.toLowerCase()}::${track.year ?? ""}`;
    if (selectedLookup.has(key)) return;
    setSelectedTracks((prev) => [
      ...prev,
      {
        id: makeTrackId(),
        artist: track.artist,
        title: track.title,
        year: track.year ? String(track.year) : "",
      },
    ]);
  };

  const addManualTrack = () => {
    setSelectedTracks((prev) => [...prev, { id: makeTrackId(), artist: "", title: "", year: "" }]);
  };

  const updateTrack = (id: string, patch: Partial<PlaylistTrack>) => {
    setSelectedTracks((prev) => prev.map((track) => (track.id === id ? { ...track, ...patch } : track)));
  };

  const removeTrack = (id: string) => {
    setSelectedTracks((prev) => prev.filter((track) => track.id !== id));
  };

  const moveTrack = (id: string, direction: -1 | 1) => {
    setSelectedTracks((prev) => {
      const index = prev.findIndex((track) => track.id === id);
      if (index === -1) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, item);
      return clone;
    });
  };

  const clearAll = () => setSelectedTracks([]);

  const exportCsv = () => {
    const rows = selectedTracks.map((track, index) => [
      String(index + 1),
      track.artist,
      track.title,
      track.year,
    ]);
    const csv = toCsv([EXPORT_COLUMNS, ...rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const filename = `${playlistName.trim() || "rockstar-import-playlist"}.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.toLowerCase().replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin/games" className="text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <h1 className="text-base font-semibold text-slate-900">Playlist Export Builder</h1>
            <p className="text-xs text-slate-500">Export format: Rank, Artist, Title, Year</p>
          </div>
          <div className="w-5" />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Playlist Name</label>
          <input
            value={playlistName}
            onChange={(event) => setPlaylistName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />

          <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search Tracks</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or artist..."
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <p className="mt-2 text-xs text-slate-500">Type at least 2 characters. Click Add to include in export.</p>

          <div className="mt-4 max-h-[460px] overflow-auto rounded-xl border border-slate-200">
            {isSearching ? <div className="p-3 text-sm text-slate-500">Searching…</div> : null}
            {searchError ? <div className="p-3 text-sm text-rose-600">{searchError}</div> : null}
            {!isSearching && !searchError && query.trim().length >= 2 && searchResults.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No matches found.</div>
            ) : null}
            {searchResults.map((track) => (
              <div key={`${track.inventory_id}-${track.recording_id}-${track.title}`} className="border-b border-slate-100 p-3 last:border-b-0">
                <div className="text-sm font-semibold text-slate-900">{track.title}</div>
                <div className="text-xs text-slate-500">
                  {track.artist} {track.year ? `• ${track.year}` : ""}
                </div>
                <button
                  type="button"
                  onClick={() => addTrack(track)}
                  className="mt-2 rounded-md border border-indigo-500 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tracks Selected</h2>
              <p className="text-xs text-slate-500">{selectedTracks.length} tracks in export order</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addManualTrack}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Add Manual Row
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={selectedTracks.length === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={selectedTracks.length === 0}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Rank</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Artist</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Year</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedTracks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                      No tracks yet. Search and add tracks, or add manual rows.
                    </td>
                  </tr>
                ) : (
                  selectedTracks.map((track, index) => (
                    <tr key={track.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{index + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          value={track.artist}
                          onChange={(event) => updateTrack(track.id, { artist: event.target.value })}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={track.title}
                          onChange={(event) => updateTrack(track.id, { title: event.target.value })}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={track.year}
                          onChange={(event) => updateTrack(track.id, { year: event.target.value.replace(/[^\d]/g, "").slice(0, 4) })}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => moveTrack(track.id, -1)}
                            disabled={index === 0}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTrack(track.id, 1)}
                            disabled={index === selectedTracks.length - 1}
                            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTrack(track.id)}
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Exported columns are fixed to match your template exactly: <span className="font-semibold">Rank, Artist, Title, Year</span>.
          </div>
        </section>
      </main>
    </div>
  );
}
