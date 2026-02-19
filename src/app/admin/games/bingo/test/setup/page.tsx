// Path: src/app/admin/games/bingo/test/setup/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronDown, X } from "lucide-react";

type BingoTarget = {
  id: string;
  name: string;
  description: string;
  pattern: boolean[][]; // 5x5 grid, true = filled
};

const BINGO_TARGETS: BingoTarget[] = [
  {
    id: "one_line",
    name: "Single Line",
    description: "At least one line in any direction",
    pattern: [
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
    ],
  },
  {
    id: "two_lines",
    name: "Double Line",
    description: "At least two lines in any direction",
    pattern: [
      [true, false, true, false, false],
      [true, false, true, false, false],
      [true, false, true, false, false],
      [true, false, true, false, false],
      [true, false, true, false, false],
    ],
  },
  {
    id: "three_lines",
    name: "Triple Line",
    description: "At least three lines in any direction",
    pattern: [
      [true, false, true, false, true],
      [true, false, true, false, true],
      [true, false, true, false, true],
      [true, false, true, false, true],
      [true, false, true, false, true],
    ],
  },
  {
    id: "four_corners",
    name: "Four Corners",
    description: "Each corner square on the card",
    pattern: [
      [true, false, false, false, true],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [true, false, false, false, true],
    ],
  },
  {
    id: "edges",
    name: "Edges",
    description: "Four lines around the outer border of the card",
    pattern: [
      [true, true, true, true, true],
      [true, false, false, false, true],
      [true, false, false, false, true],
      [true, false, false, false, true],
      [true, true, true, true, true],
    ],
  },
  {
    id: "x_shape",
    name: "Criss-Cross",
    description: "Both diagonal lines on the card",
    pattern: [
      [true, false, false, false, true],
      [false, true, false, true, false],
      [false, false, true, false, false],
      [false, true, false, true, false],
      [true, false, false, false, true],
    ],
  },
  {
    id: "full_card",
    name: "Blackout",
    description: "Every square on the card",
    pattern: [
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
      [true, true, true, true, true],
    ],
  },
];

function PatternGrid({
  pattern,
  size = "md",
}: {
  pattern: boolean[][];
  size?: "sm" | "md";
}) {
  const cellSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={`grid grid-cols-5 ${gap}`}>
      {pattern.flat().map((filled, i) => (
        <div
          key={i}
          className={`${cellSize} rounded-sm ${
            filled ? "bg-blue-500" : "bg-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

export default function GameSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [selectedTarget, setSelectedTarget] = useState<BingoTarget>(
    BINGO_TARGETS[0]
  );
  const [selectedVariant, setSelectedVariant] = useState<"standard" | "death" | "blackout">("standard");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const startGame = async () => {
    try {
      // Create game session
      const res = await fetch("/api/game-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_template_id: templateId,
          bingo_target: selectedTarget.id,
          variant: selectedVariant,
        }),
      });

      if (res.ok) {
        const session = await res.json();
        router.push(`/admin/games/bingo/test/host?sessionId=${session.id}`);
      }
    } catch (error) {
      console.error("Failed to create game:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#121212]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold">Game Setup</h1>
          <button
            onClick={() => router.push("/admin/games/bingo/test")}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {/* Tip */}
        <div className="mb-6 rounded-lg bg-[#1a1a1a] p-4">
          <div className="mb-2 inline-block rounded bg-purple-600 px-2 py-0.5 text-xs font-semibold uppercase">
            Tip
          </div>
          <p className="text-sm text-gray-300">
            Settings take effect in real-time and you can change them throughout
            the game.
          </p>
        </div>

        {/* Bingo Target */}
        <div className="rounded-lg bg-[#1a1a1a] p-4">
          <h2 className="mb-4 text-lg font-semibold">Bingo Target</h2>

          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-gray-300">Mode</span>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value as "standard" | "death" | "blackout")}
              className="w-full rounded-lg border border-purple-500 bg-transparent px-4 py-3 text-left transition hover:bg-white/5"
            >
              <option value="standard" className="bg-[#252525]">Standard</option>
              <option value="blackout" className="bg-[#252525]">Blackout</option>
              <option value="death" className="bg-[#252525]">Death (Reverse Bingo)</option>
            </select>
          </label>

          {/* Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-purple-500 bg-transparent px-4 py-3 text-left transition hover:bg-white/5"
            >
              <span>{selectedTarget.name}</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-[#252525] shadow-xl">
                {BINGO_TARGETS.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => {
                      setSelectedTarget(target);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-white/5 ${
                      selectedTarget.id === target.id ? "bg-white/10" : ""
                    }`}
                  >
                    <PatternGrid pattern={target.pattern} size="sm" />
                    <div>
                      <div className="font-medium">{target.name}</div>
                      <div className="text-sm text-gray-400">
                        {target.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Target Preview */}
          <div className="mt-6 text-center">
            <h3 className="text-xl font-semibold">{selectedTarget.name}</h3>
            <p className="mt-1 text-sm text-gray-400">
              {selectedTarget.description.replace("in any direction", "in ")}
              {selectedTarget.description.includes("in any direction") && (
                <span className="underline">any</span>
              )}
              {selectedTarget.description.includes("in any direction") &&
                " direction."}
            </p>
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg bg-[#252525] p-4">
                <PatternGrid pattern={selectedTarget.pattern} size="md" />
              </div>
            </div>
          </div>

          {/* Show More */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="mt-6 w-full text-center text-sm font-medium uppercase tracking-wide text-cyan-400 hover:text-cyan-300"
          >
            {showMore ? "Show Less" : "Show More"}
          </button>

          {showMore && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {BINGO_TARGETS.filter((t) => t.id !== selectedTarget.id).map(
                (target) => (
                  <button
                    key={target.id}
                    onClick={() => setSelectedTarget(target)}
                    className="flex flex-col items-center gap-2 rounded-lg bg-[#252525] p-3 transition hover:bg-[#303030]"
                  >
                    <PatternGrid pattern={target.pattern} size="sm" />
                    <span className="text-xs font-medium">{target.name}</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* Continue Button */}
        <button
          onClick={startGame}
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 py-4 font-semibold uppercase tracking-wide transition hover:from-purple-500 hover:to-violet-500"
        >
          Continue
        </button>
      </main>
    </div>
  );
}
