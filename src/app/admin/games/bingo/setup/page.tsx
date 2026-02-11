"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import BingoHeader from "../_components/BingoHeader";
import { buildBingoCards, buildPickList, BingoItem, BingoVariant } from "src/lib/bingo";
import Link from "next/link";

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

const GAME_TYPES: { value: BingoVariant; label: string; description: string }[] = [
  { value: "standard", label: "Standard Bingo", description: "Free space in the center." },
  { value: "death", label: "Death Bingo", description: "Avoid bingos. Last card standing wins." },
  { value: "blackout", label: "Blackout Bingo", description: "Fill the entire card to win." },
];

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
  <div className="flex items-center justify-between gap-6 border-b border-slate-200 px-6 py-4 last:border-b-0">
    <div>
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
      aria-pressed={checked}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-white shadow transition ${
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
        className={`h-2.5 w-2.5 rounded-full ${filled.includes(index) ? "bg-blue-500" : "bg-slate-200"}`}
      />
    ))}
  </div>
);

const LinkRow = ({
  title,
  description,
  href,
  hasBorder = true,
}: {
  title: string;
  description: string;
  href: string;
  hasBorder?: boolean;
}) => (
  <Link
    href={href}
    className={`flex items-center justify-between px-6 py-4 ${hasBorder ? "border-b border-slate-200" : ""} hover:bg-slate-50`}
  >
    <div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="text-xs text-slate-500">{description}</div>
    </div>
    <span className="text-slate-400">›</span>
  </Link>
);

type TemplateItem = {
  id: number;
  title: string;
  artist: string;
};

type TemplateSummary = {
  id: number;
  name: string;
  setlist_mode: boolean;
};

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = Number(searchParams.get("templateId"));
  const initialVariant = (searchParams.get("variant") as BingoVariant) || "standard";

  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [target, setTarget] = useState("one_line");
  const [showMore, setShowMore] = useState(false);
  const [variant, setVariant] = useState<BingoVariant>(initialVariant);
  const [cardCount, setCardCount] = useState(40);
  const [setlistMode, setSetlistMode] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const [bingoVerification, setBingoVerification] = useState(false);
  const [highlightCurrentColumn, setHighlightCurrentColumn] = useState(true);
  const [hideArtist, setHideArtist] = useState(false);
  const [scoreboard, setScoreboard] = useState(false);
  const [catchUp, setCatchUp] = useState(false);
  const [winnerContact, setWinnerContact] = useState(false);

  useEffect(() => {
    if (!templateId || Number.isNaN(templateId)) return;
    const load = async () => {
      const response = await fetch(`/api/game-templates/${templateId}`);
      const payload = await response.json();
      setTemplate(payload.data?.template ?? null);
      setItems(payload.data?.items ?? []);
      setSetlistMode(Boolean(payload.data?.template?.setlist_mode));
    };
    void load();
  }, [templateId]);

  const activeTarget = useMemo(
    () => bingoTargets.find((entry) => entry.value === target) ?? bingoTargets[0],
    [target]
  );

  const handleCreateSession = async () => {
    if (!templateId) return;
    setIsWorking(true);
    try {
      const response = await fetch("/api/game-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          variant,
          bingoTarget: target,
          cardCount,
          setlistMode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) return;
      const sessionId = payload.data?.session?.id;
      if (sessionId) {
        localStorage.setItem(
          `bingo-settings-${sessionId}`,
          JSON.stringify({
            bingoVerification,
            highlightCurrentColumn,
            hideArtist,
            scoreboard,
            catchUp,
            winnerContact,
          })
        );
        router.push(`/admin/games/bingo/playback?sessionId=${sessionId}`);
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownloadPickList = async () => {
    if (items.length === 0) return;
    const payload: BingoItem[] = items.map((item) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
    }));
    const pickList = buildPickList(payload, setlistMode ? "setlist" : "shuffle");
    const { generatePickListPdf } = await import("src/lib/pickListPdf");
    const doc = generatePickListPdf(pickList, `${template?.name ?? "Music Bingo"} Pick List`);
    doc.save("music-bingo-pick-list.pdf");
  };

  const handleDownloadCards = async () => {
    if (items.length === 0) return;
    const payload: BingoItem[] = items.map((item) => ({
      id: String(item.id),
      title: item.title,
      artist: item.artist,
    }));
    const cards = buildBingoCards(payload, cardCount, variant);
    const { generateBingoCardsPdf } = await import("src/lib/bingoPdf");
    const doc = generateBingoCardsPdf(cards, "Music Bingo Cards");
    doc.save("music-bingo-cards.pdf");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <BingoHeader backHref="/admin/games/bingo" title="Game Setup" />

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Game Setup</h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-600">
              TIP
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Settings take effect in real-time and you can change them throughout the game.
            </p>
            <div className="mt-4 text-xs text-slate-500">
              Playlist: {template?.name ?? "Select a playlist"} · Songs: {items.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <div className="text-sm font-semibold text-slate-900">Bingo Target</div>
              <div className="text-xs text-slate-500 mt-1">Choose a win condition for this session.</div>
            </div>
            <div className="px-6 py-4">
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {bingoTargets.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>

              <div className="text-center mt-6">
                <div className="text-base font-semibold text-slate-900">{activeTarget.label}</div>
                <div className="text-xs text-slate-500 mt-1">{activeTarget.description}</div>
                <div className="mt-4 flex justify-center">
                  <BingoPattern filled={patternMap[activeTarget.value] ?? []} />
                </div>
              </div>
            </div>

            {showMore ? (
              <div className="border-t border-slate-200 bg-slate-50 max-h-64 overflow-auto">
                {bingoTargets.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setTarget(entry.value)}
                    className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-200 last:border-b-0 hover:bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <BingoPattern filled={patternMap[entry.value] ?? []} />
                      <div className="text-left">
                        <div className="text-sm font-semibold text-slate-900">{entry.label}</div>
                        <div className="text-xs text-slate-500">{entry.description}</div>
                      </div>
                    </div>
                    <span className="text-slate-400">›</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="border-t border-slate-200 px-6 py-4 text-center">
              <button
                type="button"
                onClick={() => setShowMore((prev) => !prev)}
                className="text-xs font-semibold tracking-wide text-indigo-600"
              >
                {showMore ? "SHOW LESS" : "SHOW MORE"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <LinkRow
              title="Jumbotron"
              description="Customize a page intended as a large display."
              href="/admin/games/bingo/settings"
            />
            <LinkRow
              title="Branding"
              description="Customize branding elements for this specific game."
              href="/admin/games/bingo/settings/branding"
            />
            <LinkRow
              title="Venue"
              description="Add information about the location you’re hosting this game at."
              href="/admin/games/bingo/settings/venue"
              hasBorder={false}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Game Type</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {GAME_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setVariant(type.value)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    variant === type.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{type.label}</div>
                  <div className="text-xs text-slate-500">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Game Tools</div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Cards per game
                <input
                  type="number"
                  min={1}
                  value={cardCount}
                  onChange={(event) => setCardCount(Number(event.target.value) || 1)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700 mt-7">
                <input
                  type="checkbox"
                  checked={setlistMode}
                  onChange={(event) => setSetlistMode(event.target.checked)}
                  className="accent-indigo-600"
                />
                Setlist mode (ordered pick list)
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownloadCards}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Print Cards
              </button>
              <button
                type="button"
                onClick={handleDownloadPickList}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Pick List PDF
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isWorking || !templateId}
              className="w-full max-w-md rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Continue
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
