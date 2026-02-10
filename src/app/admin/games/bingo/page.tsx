"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";
import { buildBingoCards, buildPickList, BingoItem, BingoVariant } from "src/lib/bingo";
import { useSearchParams } from "next/navigation";

const bingoTargets = [
  { value: "one_line", label: "One Line" },
  { value: "two_lines", label: "Two Lines" },
  { value: "three_lines", label: "Three Lines" },
  { value: "four_lines", label: "Four Lines" },
  { value: "four_corners", label: "Four Corners" },
  { value: "edges", label: "Edges" },
  { value: "x_shape", label: "X Shape" },
  { value: "full_card", label: "Full Card" },
];

type FormState = {
  variant: BingoVariant;
  target: string;
  cardCount: number;
  setlistMode: boolean;
};

type TemplateSummary = {
  id: number;
  name: string;
  setlist_mode: boolean;
};

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
};

type GameSession = {
  id: number;
  game_code: string | null;
};

export default function Page() {
  const [form, setForm] = useState<FormState>({
    variant: "standard",
    target: "one_line",
    cardCount: 40,
    setlistMode: false,
  });
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [session, setSession] = useState<GameSession | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const searchParams = useSearchParams();

  const hasFreeSpace = form.variant === "standard";

  const variantDescription = useMemo(() => {
    if (form.variant === "standard") {
      return "Win on the selected target. Includes a free center space.";
    }
    if (form.variant === "death") {
      return "First bingo loses. Last card standing wins. No free space.";
    }
    return "Win by covering the entire card. No free space.";
  }, [form.variant]);

  const joinUrl = session?.game_code ? `/join/${session.game_code}` : null;

  const refreshTemplates = async () => {
    const response = await fetch("/api/game-templates");
    const payload = await response.json();
    setTemplates(payload.data ?? []);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  useEffect(() => {
    const param = searchParams.get("templateId");
    if (!param) return;
    const id = Number(param);
    if (!id || Number.isNaN(id)) return;
    setSelectedTemplateId(id);
    void loadTemplateItems(id);
  }, [searchParams]);

  const loadTemplateItems = async (templateId: number) => {
    const response = await fetch(`/api/game-templates/${templateId}`);
    const payload = await response.json();
    setTemplateItems(payload.data?.items ?? []);
  };

  const handleTemplateSelect = async (value: string) => {
    const id = Number(value);
    if (!id || Number.isNaN(id)) {
      setSelectedTemplateId(null);
      setTemplateItems([]);
      return;
    }
    setSelectedTemplateId(id);
    await loadTemplateItems(id);
  };

  const handleCreateSession = async () => {
    if (!selectedTemplateId) return;
    setIsWorking(true);
    try {
      const response = await fetch("/api/game-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          variant: form.variant,
          bingoTarget: form.target,
          cardCount: form.cardCount,
          setlistMode: form.setlistMode,
        }),
      });
      const payload = await response.json();
      setSession(payload.data?.session ?? null);
    } finally {
      setIsWorking(false);
    }
  };

  const handleGenerateCards = async () => {
    if (templateItems.length === 0) return;
    setIsWorking(true);
    try {
      const items: BingoItem[] = templateItems.map((item) => ({
        id: String(item.id),
        title: item.title,
        artist: item.artist,
      }));
      const cards = buildBingoCards(items, form.cardCount, form.variant);
      const { generateBingoCardsPdf } = await import("src/lib/bingoPdf");
      const doc = generateBingoCardsPdf(cards, "Music Bingo Cards");
      doc.save("music-bingo-cards.pdf");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate cards.";
      alert(message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownloadPickList = () => {
    if (templateItems.length === 0) return;
    const items: BingoItem[] = templateItems.map((item) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
    }));
    const pickList = buildPickList(items, form.setlistMode ? "setlist" : "shuffle");
    const rows = [
      ["Order", "Title", "Artist"],
      ...pickList.map((item, index) => [String(index + 1), item.title, item.artist]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/\"/g, '""')}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "music-bingo-pick-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Music Bingo</h1>
          <p className="text-sm text-gray-500 mt-2">
            Vinyl-only bingo. Build a playlist from your 7\"-12\" collection, generate cards, and run the game.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/games/bingo/templates">
            <Button variant="secondary" size="sm">Manage Playlists</Button>
          </Link>
          <Link href="/admin/games/bingo/history">
            <Button variant="secondary" size="sm">Game History</Button>
          </Link>
          <Link href="/admin/games/bingo/lobby">
            <Button variant="secondary" size="sm">Lobby</Button>
          </Link>
          <Link href="/admin/games/bingo/host">
            <Button size="sm">Host Controls</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Game Setup</h2>
            <p className="text-sm text-gray-600 mt-1">Configure the variant, target, and card output.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Game Type
                <select
                  value={form.variant}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, variant: event.target.value as BingoVariant }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="standard">Standard Bingo</option>
                  <option value="death">Death Bingo</option>
                  <option value="blackout">Blackout Bingo</option>
                </select>
                <span className="text-xs text-gray-500">{variantDescription}</span>
              </label>

              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Bingo Target
                <select
                  value={form.target}
                  onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {bingoTargets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Cards Per Game
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={form.cardCount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cardCount: Number(event.target.value) || 1 }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">4-up layout on US letter.</span>
              </label>

              <label className="flex items-center gap-3 text-sm text-gray-700 mt-6">
                <input
                  type="checkbox"
                  checked={form.setlistMode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, setlistMode: event.target.checked }))
                  }
                  className="accent-blue-600"
                />
                Setlist Mode (ordered pick list)
              </label>
            </div>

            <div className="mt-5 text-sm text-gray-600">
              Free center space: <span className="font-semibold">{hasFreeSpace ? "Enabled" : "Disabled"}</span>
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <Button size="sm" onClick={handleGenerateCards} disabled={isWorking || templateItems.length === 0}>
                Generate Cards
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownloadPickList} disabled={isWorking || templateItems.length === 0}>
                Download Pick List
              </Button>
            </div>
          </section>

          <section className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Playlist</h2>
            <p className="text-sm text-gray-600 mt-1">Choose or build a vinyl-only playlist for this game.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              <select
                value={selectedTemplateId ?? ""}
                onChange={(event) => void handleTemplateSelect(event.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a playlist</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Link href="/admin/games/bingo/templates">
                <Button variant="secondary" size="sm" fullWidth>
                  Manage Playlists
                </Button>
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {templateItems.length > 0
                ? `${templateItems.length} songs loaded.`
                : "No playlist loaded."}
            </p>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Host Checklist</h3>
            <ul className="text-sm text-gray-600 mt-4 space-y-3">
              <li>Build vinyl-only playlist.</li>
              <li>Generate and print cards (4-up letter).</li>
              <li>Download pick list (ordered or shuffled).</li>
              <li>Open host controls and start game.</li>
            </ul>
          </section>

          <section className="border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Session Status</h3>
            <p className="text-xs text-gray-500 mt-2">
              {session?.game_code ? `Active code: ${session.game_code}` : "No active session."}
            </p>
            {joinUrl && (
              <p className="text-xs text-gray-500 mt-2">Join URL: {joinUrl}</p>
            )}
            <Button
              size="sm"
              className="mt-4"
              fullWidth
              onClick={handleCreateSession}
              disabled={isWorking || !selectedTemplateId}
            >
              Create Session
            </Button>
          </section>
        </aside>
      </div>
    </Container>
  );
}
