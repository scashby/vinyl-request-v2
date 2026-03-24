import type { GameMode } from "src/lib/bingoEngine";

export type RoundModesEntry = {
  round: number;
  modes: GameMode[];
};

export const GAME_MODE_OPTIONS: Array<{ value: GameMode; label: string }> = [
  { value: "single_line", label: "Single Line" },
  { value: "double_line", label: "Double Line" },
  { value: "triple_line", label: "Triple Line" },
  { value: "criss_cross", label: "Criss-Cross" },
  { value: "four_corners", label: "Four Corners" },
  { value: "blackout", label: "Blackout" },
  { value: "death", label: "Death" },
];

const GAME_MODE_SET = new Set<GameMode>(GAME_MODE_OPTIONS.map((option) => option.value));
const GAME_MODE_ORDER = new Map<GameMode, number>(GAME_MODE_OPTIONS.map((option, index) => [option.value, index]));

const GAME_MODE_RULES: Record<GameMode, string> = {
  single_line: "Single Line - Complete any one line on your card: horizontal, vertical, or diagonal. First to do so wins.",
  double_line: "Double Line - Complete any two lines on your card. Lines can cross and share squares. First to do so wins.",
  triple_line: "Triple Line - Complete any three lines on your card. Lines can cross and share squares. First to do so wins.",
  criss_cross: "Criss-Cross - Complete one horizontal line and one vertical line crossing anywhere on your card, or complete both diagonal lines. First to do so wins.",
  four_corners: "Four Corners - Mark all four corner squares on your card. First to do so wins.",
  blackout: "Blackout - Mark every square on your card. First to do so wins.",
  death: "Death - The goal is to be the last player standing. Avoid completing any line for as long as possible. When you complete a Bingo, you're eliminated. The last remaining player wins.",
};

export const WELCOME_INTRO_PREFIX = "To play, see the host for a bingo card and a dauber.";
export const WELCOME_REVEAL_COPY = "You'll hear a clip of a song. The display will show the column, then slowly will reveal the artist, then the song title.";
export const WELCOME_TIE_BREAK_COPY = "In the event of a tie, most open spaces wins. If there's still a tie, next one to get a song on their card loses.";

export function getGameModeLabel(mode: GameMode): string {
  return GAME_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? "Single Line";
}

function normalizeModeList(input: unknown): GameMode[] {
  const values = Array.isArray(input) ? input : [];
  const modes: GameMode[] = [];

  for (const value of values) {
    const candidate = String(value) as GameMode;
    if (!GAME_MODE_SET.has(candidate)) {
      throw new Error(`Unsupported game mode: ${String(value)}`);
    }
    if (!modes.includes(candidate)) {
      modes.push(candidate);
    }
  }

  modes.sort((a, b) => (GAME_MODE_ORDER.get(a) ?? 999) - (GAME_MODE_ORDER.get(b) ?? 999));
  return modes;
}

export function normalizeRoundModes(input: unknown, roundCount: number): RoundModesEntry[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error("round_modes must be an array");

  const maxRound = Math.max(1, Math.floor(roundCount || 1));
  const map = new Map<number, GameMode[]>();

  for (const rawEntry of input) {
    if (!rawEntry || typeof rawEntry !== "object") {
      throw new Error("Each round_modes entry must be an object");
    }

    const entry = rawEntry as { round?: unknown; modes?: unknown };
    const round = Math.floor(Number(entry.round));

    if (!Number.isFinite(round) || round < 1 || round > maxRound) {
      throw new Error(`round_modes.round must be between 1 and ${maxRound}`);
    }

    const modes = normalizeModeList(entry.modes);
    if (modes.length === 0) {
      throw new Error("Each round_modes entry must include at least one mode");
    }

    map.set(round, modes);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, modes]) => ({ round, modes }));
}

export function getModesForRound(roundModes: RoundModesEntry[] | null | undefined, round: number, fallbackMode: GameMode): GameMode[] {
  const targetRound = Math.max(1, Math.floor(round || 1));
  const configured = (roundModes ?? []).find((entry) => entry.round === targetRound)?.modes ?? [];
  return configured.length > 0 ? configured : [fallbackMode];
}

export function formatModeListLabel(modes: GameMode[]): string {
  const labels = modes.map((mode) => getGameModeLabel(mode));
  if (labels.length === 0) return getGameModeLabel("single_line");
  if (labels.length === 1) return labels[0];
  return labels.join(" + ");
}

export function buildWelcomeRulesContent(input: {
  round: number;
  gameMode: GameMode;
  roundModes?: RoundModesEntry[] | null;
  hostNote?: string | null;
}): {
  intro: string;
  modeRules: string[];
  tieBreak: string;
  hostNote: string | null;
  activeModes: GameMode[];
} {
  const activeModes = getModesForRound(input.roundModes ?? [], input.round, input.gameMode);
  const modeLabel = formatModeListLabel(activeModes);

  return {
    intro: `${WELCOME_INTRO_PREFIX} Tonight we are playing ${modeLabel} bingo. ${WELCOME_REVEAL_COPY}`,
    modeRules: activeModes.map((mode) => GAME_MODE_RULES[mode]),
    tieBreak: WELCOME_TIE_BREAK_COPY,
    hostNote: input.hostNote?.trim() ? input.hostNote.trim() : null,
    activeModes,
  };
}
