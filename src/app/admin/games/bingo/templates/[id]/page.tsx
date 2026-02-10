"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";

type Template = {
  id: number;
  name: string;
  setlist_mode: boolean;
};

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
  side: string | null;
  position: string | null;
};

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [name, setName] = useState("");
  const [setlistMode, setSetlistMode] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const templateId = Number(params.id);

  const loadTemplate = async () => {
    const response = await fetch(`/api/game-templates/${templateId}`);
    const payload = await response.json();
    setTemplate(payload.data?.template ?? null);
    setItems(payload.data?.items ?? []);
    setName(payload.data?.template?.name ?? "");
    setSetlistMode(Boolean(payload.data?.template?.setlist_mode));
  };

  useEffect(() => {
    if (!templateId || Number.isNaN(templateId)) return;
    void loadTemplate();
  }, [templateId]);

  const handleSave = async () => {
    setIsWorking(true);
    try {
      await fetch(`/api/game-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, setlistMode }),
      });
      await loadTemplate();
    } finally {
      setIsWorking(false);
    }
  };

  const handleRebuild = async () => {
    if (!confirm("Rebuild this playlist from your vinyl collection?")) return;
    setIsWorking(true);
    try {
      await fetch(`/api/game-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebuild: true }),
      });
      await loadTemplate();
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    setIsWorking(true);
    try {
      await fetch(`/api/game-template-items/${itemId}`, { method: "DELETE" });
      await loadTemplate();
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!confirm("Delete this playlist?")) return;
    setIsWorking(true);
    try {
      await fetch(`/api/game-templates/${templateId}`, { method: "DELETE" });
      router.push("/admin/games/bingo/templates");
    } finally {
      setIsWorking(false);
    }
  };

  if (!template) {
    return (
      <Container size="md" className="py-8 min-h-screen">
        <p className="text-sm text-gray-500">Loading playlist...</p>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Playlist</h1>
          <p className="text-sm text-gray-500 mt-2">Vinyl-only songs. Edit metadata and remove tracks.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/games/bingo">
            <Button variant="secondary" size="sm">Back to Bingo</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={handleDeleteTemplate} disabled={isWorking}>
            Delete Playlist
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Playlist Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <label className="flex flex-col gap-2 text-sm text-gray-700">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 mt-6">
              <input
                type="checkbox"
                checked={setlistMode}
                onChange={(event) => setSetlistMode(event.target.checked)}
                className="accent-blue-600"
              />
              Setlist Mode (ordered)
            </label>
          </div>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button size="sm" onClick={handleSave} disabled={isWorking}>
              Save Changes
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRebuild} disabled={isWorking}>
              Rebuild from Vinyl Collection
            </Button>
          </div>
        </section>

        <aside className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Playlist Stats</h3>
          <p className="text-sm text-gray-600 mt-3">Tracks: {items.length}</p>
          <p className="text-sm text-gray-600">Mode: {setlistMode ? "Setlist" : "Shuffle"}</p>
        </aside>
      </div>

      <section className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Tracks</h2>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No tracks in this playlist.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.artist}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">
                    {item.side ? `Side ${item.side}` : ""} {item.position ?? ""}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={isWorking}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </Container>
  );
}
