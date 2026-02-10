"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";

type TemplateSummary = {
  id: number;
  name: string;
  setlist_mode: boolean;
};

export default function Page() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  const refreshTemplates = async () => {
    const response = await fetch("/api/game-templates");
    const payload = await response.json();
    setTemplates(payload.data ?? []);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  const handleBuildVinylPlaylist = async () => {
    setIsWorking(true);
    try {
      await fetch("/api/game-templates", { method: "POST" });
      await refreshTemplates();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Music Bingo Playlists</h1>
          <p className="text-sm text-gray-500 mt-2">
            Vinyl-only playlists built from your collection (7"-12").
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleBuildVinylPlaylist} disabled={isWorking}>
            Build Vinyl Playlist
          </Button>
          <Button size="sm">Create Playlist</Button>
        </div>
      </div>

      <div className="space-y-4">
        {templates.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-2xl p-6 text-sm text-gray-500">
            No playlists yet. Use "Build Vinyl Playlist" to generate one from your collection.
          </div>
        ) : (
          templates.map((template) => (
          <div
            key={template.id}
            className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {template.setlist_mode ? "Setlist" : "Shuffled"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Edit</Button>
              <Link href="/admin/games/bingo">
                <Button size="sm">Use in Game</Button>
              </Link>
            </div>
          </div>
        ))
        )}
      </div>
    </Container>
  );
}
