"use client";

import { useMemo, useState } from "react";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";

const playlist = [
  { id: "1", title: "I Want Candy", artist: "Bow Wow Wow" },
  { id: "2", title: "Jessie's Girl", artist: "Rick Springfield" },
  { id: "3", title: "Rock Me Amadeus", artist: "Falco" },
  { id: "4", title: "It's the End of the World", artist: "R.E.M." },
  { id: "5", title: "Working for the Weekend", artist: "Loverboy" },
];

export default function Page() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = playlist[currentIndex];

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < playlist.length - 1;

  const history = useMemo(() => playlist.slice(0, currentIndex), [currentIndex]);

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Music Bingo Host</h1>
          <p className="text-sm text-gray-500 mt-2">
            Manual vinyl playback. Advance the pick list as you play each track.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Finish Game</Button>
          <Button size="sm">Start Game</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">Now Playing</div>
          <div className="mt-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
            <div className="text-lg font-semibold text-gray-900">{current.title}</div>
            <div className="text-sm text-gray-600">{current.artist}</div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              Previous Song
            </Button>
            <Button
              size="sm"
              disabled={!hasNext}
              onClick={() => setCurrentIndex((prev) => Math.min(playlist.length - 1, prev + 1))}
            >
              Next Song
            </Button>
          </div>
        </section>

        <aside className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">Called Songs</div>
          <div className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No songs called yet.</p>
            ) : (
              history.map((song, index) => (
                <div key={song.id} className="text-sm text-gray-700">
                  {index + 1}. {song.title} — {song.artist}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </Container>
  );
}
