"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "components/ui/Container";
import { buildBingoCards, buildPickList, BingoItem, BingoVariant } from "src/lib/bingo";

const bingoTargets = [
  { value: "one_line", label: "One Line", description: "At least one line in any direction" },
  { value: "two_lines", label: "Two Lines", description: "At least two lines in any direction" },
  { value: "three_lines", label: "Three Lines", description: "At least three lines in any direction" },
  { value: "four_lines", label: "Four Lines", description: "At least four lines in any direction" },
  { value: "four_corners", label: "Four Corners", description: "Each corner square on the card" },
  { value: "edges", label: "Edges", description: "Four lines around the outer border" },
  { value: "x_shape", label: "X Shape", description: "Both diagonal lines" },
  { value: "full_card", label: "Full Card", description: "Every square on the card" },
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

const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) => (
  <div className="flex items-center justify-between gap-6 border-b border-gray-200 px-6 py-4 last:border-b-0">
    <div>
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full transition-colors ${
        checked ? "bg-violet-600" : "bg-gray-200"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`block w-6 h-6 bg-white rounded-full shadow transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  </div>
);

const BingoPattern = ({ filled }: { filled: number[] }) => (
  <div className="grid grid-cols-5 gap-1">
    {Array.from({ length: 25 }).map((_, index) => (
      <span
        key={index}
        className={`h-2.5 w-2.5 rounded-full ${
          filled.includes(index) ? "bg-blue-500" : "bg-gray-200"
        }`}
      />
    ))}
  </div>
);

const patternMap: Record<string, number[]> = {
  one_line: [2, 7, 12, 17, 22],
  two_lines: [0, 1, 2, 3, 4, 20, 21, 22, 23, 24],
  three_lines: [0, 5, 10, 15, 20, 2, 7, 12, 17, 22, 4, 9, 14, 19, 24],
  four_lines: [0, 1, 2, 3, 4, 5, 10, 15, 20, 21, 22, 23, 24, 9, 14],
  four_corners: [0, 4, 20, 24],
  edges: [0, 1, 2, 3, 4, 5, 10, 15, 20, 21, 22, 23, 24, 9, 14],
  x_shape: [0, 6, 12, 18, 24, 4, 8, 12, 16, 20],
  full_card: Array.from({ length: 25 }).map((_, index) => index),
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
  const [showMore, setShowMore] = useState(false);
  const [bingoVerification, setBingoVerification] = useState(false);
  const [highlightCurrentColumn, setHighlightCurrentColumn] = useState(true);
  const [hideArtist, setHideArtist] = useState(false);
  const [scoreboard, setScoreboard] = useState(false);
  const [catchUp, setCatchUp] = useState(false);
  const [winnerContact, setWinnerContact] = useState(false);
  const searchParams = useSearchParams();

  const activeTarget = useMemo(
    () => bingoTargets.find((target) => target.value === form.target) ?? bingoTargets[0],
    [form.target]
  );

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

  const refreshTemplates = async () => {
    const response = await fetch("/api/game-templates");
    const payload = await response.json();
    setTemplates(payload.data ?? []);
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  const loadTemplateItems = async (templateId: number) => {
    const response = await fetch(`/api/game-templates/${templateId}`);
    const payload = await response.json();
    setTemplateItems(payload.data?.items ?? []);
  };

  useEffect(() => {
    const param = searchParams.get("templateId");
    if (!param) return;
    const id = Number(param);
    if (!id || Number.isNaN(id)) return;
    setSelectedTemplateId(id);
    void loadTemplateItems(id);
  }, [searchParams]);

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

  const handleDownloadSessionCards = async () => {
    if (!session) return;
    const response = await fetch(`/api/game-cards?sessionId=${session.id}`);
    const payload = await response.json();
    const cards = (payload.data ?? []).map((card: any) => ({
      index: card.card_number,
      cells: card.grid,
    }));
    const { generateBingoCardsPdf } = await import("src/lib/bingoPdf");
    const doc = generateBingoCardsPdf(cards, `Music Bingo Session ${session.id}`);
    doc.save(`music-bingo-session-${session.id}-cards.pdf`);
  };

  const handleDownloadSessionPickListPdf = async () => {
    if (!session) return;
    const response = await fetch(`/api/game-sessions/${session.id}`);
    const payload = await response.json();
    const picks = payload.data?.picks ?? [];
    const items = picks.map((pick: any) => ({
      id: String(pick.id),
      title: pick.game_template_items?.title ?? "",
      artist: pick.game_template_items?.artist ?? "",
    }));
    const { generatePickListPdf } = await import("src/lib/pickListPdf");
    const doc = generatePickListPdf(items, `Music Bingo Session ${session.id} Pick List`);
    doc.save(`music-bingo-session-${session.id}-pick-list.pdf`);
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
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownloadPickListPdf = async () => {
    if (templateItems.length === 0) return;
    const items: BingoItem[] = templateItems.map((item) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
    }));
    const pickList = buildPickList(items, form.setlistMode ? "setlist" : "shuffle");
    const { generatePickListPdf } = await import("src/lib/pickListPdf");
    const doc = generatePickListPdf(pickList, "Music Bingo Pick List");
    doc.save("music-bingo-pick-list.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200">
        <Container size="lg" className="py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/games" className="text-gray-600 hover:text-gray-900">
              <span className="text-xl">←</span>
            </Link>
            <div className="text-center">
              <div className="text-sm uppercase tracking-widest text-gray-400">rockstar</div>
              <div className="text-lg font-semibold text-gray-900">bingo</div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="text-gray-400 hover:text-gray-600">⟲</button>
              <button type="button" className="text-gray-400 hover:text-gray-600">⚙</button>
            </div>
          </div>
        </Container>
      </div>

      <Container size="lg" className="py-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Game Setup</h1>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-full px-2 py-1">
              TIP
            </div>
            <p className="text-sm text-gray-600 mt-3">
              Settings take effect in real-time and you can change them throughout the game.
            </p>
            <div className="mt-4 text-xs text-gray-500">
              Playlist: {selectedTemplate?.name ?? "Select a playlist"} · Songs: {templateItems.length}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-900">Bingo Target</div>
              <div className="text-xs text-gray-500 mt-1">Choose a win condition for this session.</div>
            </div>
            <div className="px-6 py-4">
              <select
                value={form.target}
                onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700"
              >
                {bingoTargets.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>

              <div className="text-center mt-6">
                <div className="text-base font-semibold text-gray-900">{activeTarget.label}</div>
                <div className="text-xs text-gray-500 mt-1">{activeTarget.description}</div>
                <div className="mt-4 flex justify-center">
                  <BingoPattern filled={patternMap[activeTarget.value] ?? []} />
                </div>
              </div>
            </div>

            {showMore && (
              <div className="border-t border-gray-200 bg-gray-50 max-h-64 overflow-auto">
                {bingoTargets.map((target) => (
                  <button
                    key={target.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, target: target.value }))}
                    className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-200 last:border-b-0 hover:bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <BingoPattern filled={patternMap[target.value] ?? []} />
                      <div className="text-left">
                        <div className="text-sm font-semibold text-gray-900">{target.label}</div>
                        <div className="text-xs text-gray-500">{target.description}</div>
                      </div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                ))}
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-200 text-center">
              <button
                type="button"
                onClick={() => setShowMore((prev) => !prev)}
                className="text-xs font-semibold tracking-wide text-violet-600"
              >
                {showMore ? "SHOW LESS" : "SHOW MORE"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <Toggle
              checked={bingoVerification}
              onChange={setBingoVerification}
              label="Bingo Verification"
              description="Disable automatic bingo verification and confirm or deny bingos manually."
            />
            <Toggle
              checked={highlightCurrentColumn}
              onChange={setHighlightCurrentColumn}
              label="Highlight Current Column"
              description="Show guests which column the current song is under."
            />
            <Toggle
              checked={hideArtist}
              onChange={setHideArtist}
              label="Hide Artist"
              description="Increase difficulty by only displaying the song title on the card."
            />
            <Toggle
              checked={scoreboard}
              onChange={setScoreboard}
              label="Scoreboard"
              description="Show a scoreboard after each confirmed bingo."
            />
            <Toggle
              checked={catchUp}
              onChange={setCatchUp}
              label="Catch Up"
              description="Allow players to see missed squares from the game menu."
            />
            <Toggle
              checked={winnerContact}
              onChange={setWinnerContact}
              label="Winner Contact Details"
              description="Collect contact information from winning guests."
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <div className="text-sm font-semibold text-gray-900">Jumbotron</div>
                <div className="text-xs text-gray-500">Customize a page intended as a large display.</div>
              </div>
              <span className="text-gray-400">›</span>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <div className="text-sm font-semibold text-gray-900">Branding</div>
                <div className="text-xs text-gray-500">Customize branding for this game.</div>
              </div>
              <span className="text-gray-400">›</span>
            </div>
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Venue</div>
                <div className="text-xs text-gray-500">Add location details for this game.</div>
              </div>
              <span className="text-gray-400">›</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Playlist
                <select
                  value={selectedTemplateId ?? ""}
                  onChange={(event) => void handleTemplateSelect(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <option value="">Select a playlist</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Cards per game
                <input
                  type="number"
                  min={1}
                  value={form.cardCount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cardCount: Number(event.target.value) || 1 }))
                  }
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-gray-700">
                Game Type
                <select
                  value={form.variant}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, variant: event.target.value as BingoVariant }))
                  }
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <option value="standard">Standard Bingo</option>
                  <option value="death">Death Bingo</option>
                  <option value="blackout">Blackout Bingo</option>
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm text-gray-700 mt-7">
                <input
                  type="checkbox"
                  checked={form.setlistMode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, setlistMode: event.target.checked }))
                  }
                  className="accent-violet-600"
                />
                Setlist mode (ordered pick list)
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateCards}
                disabled={isWorking || templateItems.length === 0}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Generate Cards
              </button>
              <button
                type="button"
                onClick={handleDownloadPickListPdf}
                disabled={isWorking || templateItems.length === 0}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Pick List PDF
              </button>
              {session && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadSessionCards}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Session Cards
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSessionPickListPdf}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Session Pick List
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isWorking || !selectedTemplateId}
              className="w-full max-w-md rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}
